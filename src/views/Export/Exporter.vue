<script lang="ts">
import { buildProjectZip } from "../../ts/utils";
import { getProjectDoc, releaseProjectDoc } from "../../ts/ProjectDoc";

const STORAGE_KEY = "liaexporter.url";
const DEFAULT_URL = "http://localhost:3000";

export default {
  name: "ExporterModal",

  props: {
    visible: { type: Boolean, default: false },
    storageId: { type: String, default: "" },
    connection: { type: String, default: "" },
  },

  emits: ["close"],

  data() {
    return {
      url: localStorage.getItem(STORAGE_KEY) || DEFAULT_URL,
      activeUrl: "" as string, // url currently loaded in the iframe
      reloadKey: 0, // bumped on every connect to force the iframe to reload
      loaded: false, // the iframe fired its load event
      iframeReady: false, // received the 'ready' handshake
      autoSent: false, // project was auto-pushed for the current connection
      sending: false,
      sent: false,
      errorKey: "" as string, // i18n key of the current error/hint, or ""
      handshakeTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },

  computed: {
    // The origin we restrict postMessage to (and validate incoming events
    // against). Empty while no valid URL is loaded.
    activeOrigin(): string {
      try {
        return new URL(this.activeUrl).origin;
      } catch {
        return "";
      }
    },

    // An https editor cannot embed an http (non-localhost) exporter -> the
    // browser blocks it as mixed content. Detect it up front for a clear hint.
    mixedContent(): boolean {
      try {
        const u = new URL(this.url);
        const isLocalhost =
          u.hostname === "localhost" || u.hostname === "127.0.0.1";
        return (
          window.location.protocol === "https:" &&
          u.protocol === "http:" &&
          !isLocalhost
        );
      } catch {
        return false;
      }
    },
  },

  watch: {
    visible(now: boolean) {
      // Reload the iframe each time the modal is (re)opened so the export UI
      // starts fresh and re-runs the ready handshake.
      if (now) this.connect();
      else this.reset();
    },
  },

  mounted() {
    window.addEventListener("message", this.onMessage);
    if (this.visible) this.connect();
  },

  unmounted() {
    window.removeEventListener("message", this.onMessage);
    this.clearHandshakeTimer();
  },

  methods: {
    close() {
      this.$emit("close");
    },

    reset() {
      this.activeUrl = "";
      this.loaded = false;
      this.iframeReady = false;
      this.autoSent = false;
      this.sending = false;
      this.sent = false;
      this.errorKey = "";
      this.clearHandshakeTimer();
    },

    clearHandshakeTimer() {
      if (this.handshakeTimer) {
        clearTimeout(this.handshakeTimer);
        this.handshakeTimer = undefined;
      }
    },

    connect() {
      this.errorKey = "";
      this.loaded = false;
      this.iframeReady = false;
      this.autoSent = false;
      this.sent = false;

      let normalized: string;
      try {
        normalized = new URL(this.url).toString().replace(/\/$/, "");
      } catch {
        this.errorKey = "exporter.errorInvalidUrl";
        return;
      }

      this.url = normalized;
      localStorage.setItem(STORAGE_KEY, normalized);

      if (this.mixedContent) {
        this.errorKey = "exporter.errorMixedContent";
        return;
      }

      // (Re)load the iframe by pointing it at the exporter. We only push the
      // project once the exporter answers with the 'ready' postMessage handshake
      // (onMessage) — that is the *only* reliable signal that its scripts ran and
      // it can accept files. The iframe's load event (onFrameLoad) is NOT proof:
      // it also fires for a browser error page when the exporter server isn't
      // running (connection refused), and postMessage to that dead frame would
      // silently "succeed" and falsely report the project as handed over. A
      // fallback timer flags the connectivity/embedding problem if the handshake
      // never arrives.
      //
      // Bump reloadKey so the iframe reloads even when the URL is unchanged
      // (e.g. the user starts the exporter after opening this modal and clicks
      // "connect" again) — otherwise Vue keeps the stale, failed iframe.
      this.reloadKey++;
      this.activeUrl = normalized;

      this.clearHandshakeTimer();
      this.handshakeTimer = setTimeout(() => {
        if (!this.iframeReady) {
          this.errorKey = "exporter.errorNoHandshake";
        }
      }, 12000);
    },

    onFrameLoad() {
      this.loaded = true;

      // The load event fires even for a browser error page (e.g. the exporter
      // server isn't running -> connection refused), so it is NOT proof that the
      // exporter is alive — we must not auto-send or report success here. Just
      // nudge the embedded UI with a ping; an exporter that is actually running
      // answers with 'ready' (onMessage), which is what triggers the send. If no
      // 'ready' arrives, the handshake timer reports the connection problem.
      const iframe = this.$refs.frame as HTMLIFrameElement | undefined;
      if (iframe?.contentWindow && this.activeOrigin) {
        iframe.contentWindow.postMessage(
          { type: "liaexporter:ping" },
          this.activeOrigin
        );
      }
    },

    onMessage(event: MessageEvent) {
      if (!this.activeOrigin || event.origin !== this.activeOrigin) return;
      if (event.data && event.data.type === "liaexporter:ready") {
        this.iframeReady = true;
        this.errorKey = "";
        this.clearHandshakeTimer();
        this.autoSend();
      }
    },

    // Push the project exactly once per connection, whichever trigger (load
    // event or 'ready' handshake) fires first.
    autoSend() {
      if (this.autoSent) return;
      this.autoSent = true;
      this.sendProject();
    },

    async sendProject() {
      if (!this.storageId) {
        this.errorKey = "exporter.errorNoProject";
        return;
      }

      this.sending = true;
      this.errorKey = "";

      // Read the project straight from the shared ProjectDoc (keyed by
      // storageId) instead of reaching into the editor component — that keeps
      // this independent of the component tree. This mirrors how
      // Editor.getMainValue()/getAllBlobs() collect the course + assets.
      let doc: ReturnType<typeof getProjectDoc> | undefined;
      try {
        doc = getProjectDoc(this.storageId, this.connection || undefined);

        const mainContent = doc.content.toString();
        const blobs: { name: string; data: Uint8Array }[] = [];

        // legacy inline media (hash-keyed)
        doc.blob.forEach((data: Uint8Array, name: string) => {
          blobs.push({ name, data });
        });

        // all explorer files (binary + editable text)
        doc.files.forEach((meta, path) => {
          if (meta.type !== "file") return;
          const data = doc!.readFileData(path);
          if (data) blobs.push({ name: path, data });
        });

        const fileName =
          "Project-" + (this.storageId.slice(0, 8) || "xxxxxxxx") + ".zip";

        const file = await buildProjectZip(mainContent, blobs, fileName);

        const iframe = this.$refs.frame as HTMLIFrameElement | undefined;
        if (!iframe?.contentWindow) {
          this.errorKey = "exporter.errorNoHandshake";
          return;
        }

        // Hand the whole project to the embedded exporter UI; it picks it up as
        // if the user had dropped the ZIP into its upload area.
        iframe.contentWindow.postMessage(file, this.activeOrigin);
        this.sent = true;
      } catch (e) {
        console.error("Failed to send project to exporter:", e);
        this.errorKey = "exporter.errorSend";
      } finally {
        if (doc) releaseProjectDoc(this.storageId);
        this.sending = false;
      }
    },

    // Manually re-push the project (e.g. after editing while the modal is open).
    // Only re-send in place when we have a confirmed handshake — that keeps the
    // exporter's current format/preset selection. Otherwise (e.g. the exporter
    // was started after this modal opened, so the first load failed) reconnect,
    // which reloads the iframe.
    resend() {
      if (this.iframeReady) {
        this.autoSent = true;
        this.sendProject();
      } else {
        this.connect();
      }
    },
  },
};
</script>

<template>
  <div class="exporter-modal" v-if="visible">
    <div class="modal-backdrop" @click="close"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h5 class="modal-title">
          <i class="bi bi-box-arrow-up-right me-2"></i>{{ $t('exporter.title') }}
        </h5>
        <button
          type="button"
          class="btn-close"
          @click="close"
          :aria-label="$t('exporter.close')"
        ></button>
      </div>

      <div class="modal-body">
        <!-- Server URL configuration -->
        <div class="url-bar">
          <label for="exporterUrl" class="form-label mb-1">{{ $t('exporter.urlLabel') }}</label>
          <div class="input-group">
            <input
              id="exporterUrl"
              type="url"
              class="form-control"
              v-model="url"
              :placeholder="$t('exporter.urlPlaceholder')"
              @keyup.enter="connect"
            />
            <button class="btn btn-primary" @click="connect">
              <i class="bi bi-plug"></i> {{ $t('exporter.connect') }}
            </button>
            <button
              class="btn btn-outline-secondary"
              @click="resend"
              :disabled="!iframeReady || sending"
              :title="$t('exporter.resendTitle')"
            >
              <i class="bi bi-arrow-repeat"></i> {{ $t('exporter.resend') }}
            </button>
          </div>
          <div class="form-text text-muted">{{ $t('exporter.urlHint') }}</div>
        </div>

        <!-- Status line -->
        <div v-if="errorKey" class="alert alert-warning py-2 mt-2 mb-2">
          <i class="bi bi-exclamation-triangle-fill me-2"></i>{{ $t(errorKey) }}
        </div>
        <div
          v-else-if="sent"
          class="alert alert-success py-2 mt-2 mb-2"
        >
          <i class="bi bi-check-circle-fill me-2"></i>{{ $t('exporter.handed') }}
        </div>
        <div
          v-else-if="sending"
          class="alert alert-info py-2 mt-2 mb-2"
        >
          <span class="spinner-border spinner-border-sm me-2"></span>{{ $t('exporter.sending') }}
        </div>

        <!-- Embedded exporter UI -->
        <div class="frame-wrap">
          <iframe
            v-if="activeUrl"
            :key="reloadKey"
            ref="frame"
            :src="activeUrl"
            class="exporter-frame"
            :title="$t('exporter.title')"
            @load="onFrameLoad"
          ></iframe>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exporter-modal {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  /* Bootstrap's .modal-backdrop sets z-index: 1050; keep the backdrop below the
     container so the dialog stays interactive. */
  z-index: 1;
}

.modal-container {
  position: relative;
  z-index: 2;
  background: var(--bs-body-bg, #fff);
  border-radius: 0.5rem;
  width: 92vw;
  max-width: 1100px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  box-shadow: 0 1rem 3rem rgba(0, 0, 0, 0.4);
}

.modal-header,
.modal-body {
  padding: 1rem;
}

.modal-body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.url-bar {
  flex: 0 0 auto;
}

.frame-wrap {
  flex: 1 1 auto;
  min-height: 0;
  margin-top: 0.5rem;
  border: 1px solid var(--bs-border-color, #dee2e6);
  border-radius: 0.375rem;
  overflow: hidden;
}

.exporter-frame {
  width: 100%;
  height: 100%;
  border: 0;
  display: block;
}
</style>
