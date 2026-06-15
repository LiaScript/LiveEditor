<template>
  <div class="nostr-modal" v-if="visible">
    <div class="modal-backdrop" @click="close"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h5 class="modal-title">{{ $t('nostr.title') }}</h5>
        <button
          type="button"
          class="btn-close"
          @click="close"
          :aria-label="$t('nostr.close')"
        ></button>
      </div>
      <div class="modal-body">
        <!-- Key Management Section -->
        <div v-if="step === 'initial'" class="key-management mb-4">
          <h6>{{ $t('nostr.keysSection') }}</h6>

          <!-- Public Key -->
          <div class="form-group mb-3">
            <label for="nostrPublicKey" class="form-label">{{ $t('nostr.publicKeyLabel') }}</label>
            <div class="input-group">
              <input
                id="nostrPublicKey"
                type="text"
                class="form-control"
                v-model="publicKey"
                :placeholder="$t('nostr.publicKeyPlaceholder')"
              />
              <button
                class="btn btn-outline-secondary"
                @click="generateKeyPair"
                :title="$t('nostr.generateTitle')"
              >
                <i class="bi bi-key"></i> {{ $t('nostr.generateNew') }}
              </button>
            </div>
            <div class="form-text text-muted">
              {{ $t('nostr.publicKeyHint') }}
            </div>
          </div>

          <!-- Private Key (always visible) -->
          <div class="form-group mb-3">
            <label for="nostrPrivateKey" class="form-label">{{ $t('nostr.privateKeyLabel') }}</label>
            <div class="input-group">
              <input
                id="nostrPrivateKey"
                :type="privateKeyVisible ? 'text' : 'password'"
                class="form-control"
                v-model="privateKey"
                :placeholder="$t('nostr.privateKeyPlaceholder')"
              />
              <button
                class="btn btn-outline-secondary"
                @click="togglePrivateKeyVisibility"
              >
                <i :class="privateKeyVisible ? 'bi bi-eye-slash' : 'bi bi-eye'"></i>
              </button>
              <button
                class="btn btn-outline-secondary"
                @click="copyToClipboard(privateKey)"
                :title="$t('nostr.copyToClipboard')"
                :disabled="!privateKey"
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
            <div class="form-text text-muted">
              {{ $t('nostr.privateKeyHint') }}
            </div>
          </div>

          <!-- Store credentials checkbox -->
          <div class="form-check mb-3" v-if="publicKey || privateKey">
            <input
              class="form-check-input"
              type="checkbox"
              id="storeCredentials"
              v-model="storeCredentials"
            />
            <label class="form-check-label" for="storeCredentials">
              {{ $t('nostr.storeCredentials') }}
            </label>
            <div class="form-text text-warning">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              {{ $t('nostr.storeCredentialsWarning') }}
            </div>
          </div>

          <!-- Relay Configuration -->
          <div class="form-group mb-3 mt-4">
            <label for="nostrRelays" class="form-label">{{ $t('nostr.relayServersLabel') }}</label>
            <textarea
              id="nostrRelays"
              class="form-control"
              rows="3"
              v-model="relaysText"
              :placeholder="$t('nostr.relayPlaceholder')"
            ></textarea>
            <div class="form-text text-muted">
              {{ $t('nostr.relayHint') }}
            </div>
            <div class="form-check mt-2">
              <input
                class="form-check-input"
                type="checkbox"
                id="storeRelays"
                v-model="storeRelays"
              />
              <label class="form-check-label" for="storeRelays">
                {{ $t('nostr.rememberRelays') }}
              </label>
            </div>
          </div>

          <!-- Warning box when keys are generated -->
          <div v-if="isNewlyGenerated" class="alert alert-warning">
            <div class="d-flex align-items-center mb-2">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>{{ $t('nostr.saveKeyWarningTitle') }}</strong>
            </div>
            <p class="mb-2">
              {{ $t('nostr.saveKeyWarningBody') }}
            </p>
          </div>
        </div>

        <div v-if="step === 'initial'" class="initial-view">
          <p>{{ $t('nostr.intro') }}</p>

          <div class="form-group mb-3">
            <label for="nostrUrl" class="form-label">{{ $t('nostr.nostrLinkLabel') }}</label>
            <div class="input-group">
              <input
                id="nostrUrl"
                type="text"
                class="form-control"
                readonly
                :value="nostrUrl"
              />
              <button
                class="btn btn-outline-secondary"
                @click="copyToClipboard(nostrUrl)"
                :title="$t('nostr.copyToClipboard')"
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
          </div>

          <div class="form-check mb-3 mt-3">
            <input
              class="form-check-input"
              type="checkbox"
              id="embedMedia"
              v-model="embedMedia"
            />
            <label class="form-check-label" for="embedMedia">
              {{ $t('nostr.embedMedia') }}
            </label>
            <div class="form-text text-muted">
              {{ $t('nostr.embedMediaHint') }}
            </div>
          </div>

          <div class="nostr-actions">
            <button class="btn btn-outline-primary me-2" @click="step = 'customize'">
              <i class="bi bi-pencil-square me-1"></i> {{ $t('nostr.customizePost') }}
            </button>
            <button
              class="btn btn-primary"
              @click="publishToNostr"
              :disabled="!publicKey || !privateKey"
            >
              <i class="bi bi-lightning-charge me-1"></i> {{ $t('nostr.publishNow') }}
            </button>
          </div>
        </div>

        <div v-if="step === 'customize'" class="customize-view">
          <div class="form-group mb-3">
            <label for="nostrMessage" class="form-label">{{ $t('nostr.messageLabel') }}</label>
            <textarea
              id="nostrMessage"
              class="form-control"
              rows="3"
              v-model="customMessage"
              :placeholder="$t('nostr.messagePlaceholder')"
            ></textarea>
          </div>

          <div class="form-group mb-3">
            <label class="form-label d-block">{{ $t('nostr.tagsLabel') }}</label>
            <div class="tags-container mb-2">
              <span
                v-for="(tag, index) in tags"
                :key="index"
                class="badge bg-secondary me-1 mb-1"
              >
                #{{ tag }}
                <button
                  type="button"
                  class="btn-close btn-close-white ms-1"
                  @click="removeTag(index)"
                ></button>
              </span>
            </div>
            <div class="input-group">
              <input
                type="text"
                class="form-control"
                :placeholder="$t('nostr.addTagPlaceholder')"
                v-model="newTag"
                @keydown.enter.prevent="addTag"
              />
              <button class="btn btn-outline-secondary" @click="addTag">{{ $t('nostr.addTagBtn') }}</button>
            </div>
          </div>

          <div class="nostr-actions">
            <button class="btn btn-outline-secondary me-2" @click="step = 'initial'">
              <i class="bi bi-arrow-left me-1"></i> {{ $t('nostr.backBtn') }}
            </button>
            <button
              class="btn btn-primary"
              @click="publishToNostr"
              :disabled="!publicKey"
            >
              <i class="bi bi-lightning-charge me-1"></i> {{ $t('nostr.publishBtn') }}
            </button>
          </div>
        </div>

        <div v-if="step === 'success'" class="success-view text-center">
          <div class="mb-3">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem"></i>
          </div>
          <h5>{{ $t('nostr.successTitle') }}</h5>

          <div class="form-group mb-4">
            <label class="form-label">{{ $t('nostr.accessAtLabel') }}</label>
            <div class="input-group">
              <input
                type="text"
                class="form-control"
                readonly
                :value="publishedCourseUrl"
              />
              <button
                class="btn btn-outline-secondary"
                @click="copyToClipboard(publishedCourseUrl)"
                :title="$t('nostr.copyToClipboard')"
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
          </div>

          <div class="mt-3 d-flex justify-content-between">
            <a :href="publishedCourseUrl" target="_blank" class="btn btn-primary">
              <i class="bi bi-box-arrow-up-right me-1"></i> {{ $t('nostr.openCourse') }}
            </a>
            <button class="btn btn-outline-secondary" @click="close">{{ $t('nostr.close') }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {
  generateSecretKey,
  getPublicKey,
  nip19,
  SimplePool,
  getEventHash,
  finalizeEvent,
} from "nostr-tools";
import Dexie from "../../ts/indexDB";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Utils from "../../ts/utils";

export default {
  name: "NostrModal",

  props: {
    visible: {
      type: Boolean,
      default: false,
    },
    storageId: {
      type: String,
      required: true,
    },
    courseUrl: {
      type: String,
      required: true,
    },
  },

  data() {
    return {
      step: "initial",
      customMessage: "",
      tags: ["liascript", "education"],
      newTag: "",

      imageUrl: null,
      publishStatus: null,
      publishedCourseUrl: "",

      // Nostr key management
      publicKey: "",
      privateKey: "",
      storeCredentials: true,
      privateKeyVisible: false,
      isNewlyGenerated: false,

      // Relay management
      relays: ["wss://relay.damus.io", "wss://relay.nostr.band", "wss://nos.lol"],
      storeRelays: true,

      // Embed media option
      embedMedia: false, // Default to true for better portability
    };
  },

  created() {
    // Try to load saved credentials from localStorage
    const savedPublicKey = localStorage.getItem("nostrPublicKey");
    const savedPrivateKey = localStorage.getItem("nostrPrivateKey");

    if (savedPublicKey) {
      this.publicKey = savedPublicKey;
    }

    if (savedPrivateKey) {
      this.privateKey = savedPrivateKey;
    }

    const database = new Dexie();
    database
      .get(this.storageId)
      .then((meta: any) => {
        if (meta) {
          this.customMessage = meta.meta.macro.comment || "";
          this.imageUrl = meta.meta.macro.image || null;
          this.tags = meta.meta.macro.tags?.split(",").map((tag) => tag.trim()) || [
            "liascript",
            "education",
          ];
        } else {
          console.warn("No metadata found for this course.");
        }
      })
      .catch((error) => {
        console.error("Error loading metadata:", error);
      });

    // Load saved relays
    this.loadSavedRelays();
  },

  computed: {
    nostrUrl() {
      return this.courseUrl;
    },

    relaysText: {
      get() {
        return this.relays.join("\n");
      },
      set(newValue) {
        const relayArray = newValue.split("\n").filter((relay) => relay.trim() !== "");
        this.relays = relayArray;
      },
    },
  },

  methods: {
    close() {
      // Save credentials if requested
      this.saveCredentials();

      // Save relays if requested
      this.saveRelays();

      // Reset states
      this.isNewlyGenerated = false;
      this.privateKeyVisible = false;
      this.step = "initial";

      this.$emit("close");
    },

    loadSavedRelays() {
      const savedRelays = localStorage.getItem("nostrRelays");
      if (savedRelays) {
        try {
          this.relays = JSON.parse(savedRelays);
        } catch (e) {
          console.error("Error parsing saved relays:", e);
        }
      }
    },

    saveRelays() {
      if (this.storeRelays && this.relays.length > 0) {
        localStorage.setItem("nostrRelays", JSON.stringify(this.relays));
      } else if (!this.storeRelays) {
        localStorage.removeItem("nostrRelays");
      }
    },

    generateKeyPair() {
      try {
        const privateKey = generateSecretKey();
        const publicKey = getPublicKey(privateKey);
        const npub = nip19.npubEncode(publicKey);
        const nsec = nip19.nsecEncode(privateKey);

        this.privateKey = nsec;
        this.publicKey = npub;
        this.privateKeyVisible = true;
        this.isNewlyGenerated = true;
      } catch (error) {
        console.error("Error generating key pair:", error);
        alert(this.$t('nostr.alertGenerateFailed'));
      }
    },

    togglePrivateKeyVisibility() {
      this.privateKeyVisible = !this.privateKeyVisible;
    },

    copyToClipboard(text: string) {
      navigator.clipboard.writeText(text).then(() => {});
    },

    saveCredentials() {
      if (this.storeCredentials) {
        if (this.publicKey) {
          localStorage.setItem("nostrPublicKey", this.publicKey);
        }
        if (this.privateKey) {
          localStorage.setItem("nostrPrivateKey", this.privateKey);
        }
      } else {
        localStorage.removeItem("nostrPublicKey");
        localStorage.removeItem("nostrPrivateKey");
      }
    },

    addTag() {
      if (this.newTag.trim() && !this.tags.includes(this.newTag.trim())) {
        this.tags.push(this.newTag.trim());
        this.newTag = "";
      }
    },

    removeTag(index: number) {
      this.tags.splice(index, 1);
    },

    async embedMediaAsDataURIs(content) {
      try {
        // Get all blob references from the editor
        const blobs = this.$parent.$refs.editor.getAllBlobs();

        if (!blobs || blobs.length === 0) {
          return content; // No media to embed
        }

        let modifiedContent = content;

        // Process each blob and replace references in the content
        for (const blob of blobs) {
          const fileName = blob.name;
          const fileData = blob.data;

          // Only process media files
          if (!this.isMediaFile(fileName)) {
            continue;
          }

          try {
            // Determine the MIME type based on file extension
            const mimeType = this.getMimeType(fileName);

            // Convert the blob data to a base64 data URI
            const dataUri = await this.blobToDataUri(fileData, mimeType);

            // Replace only the file references with data URIs
            // Escape special characters in the file name for regex
            const fileNameEscaped = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

            // Match URLs in markdown patterns
            // Image syntax: ![alt](fileName)
            const imgRegex = new RegExp(
              `(\\!\\[[^\\]]*\\]\\()${fileNameEscaped}(\\))`,
              "g"
            );
            modifiedContent = modifiedContent.replace(imgRegex, `$1${dataUri}$2`);

            // Link syntax: [text](fileName)
            const linkRegex = new RegExp(
              `(\\[[^\\]]*\\]\\()${fileNameEscaped}(\\))`,
              "g"
            );
            modifiedContent = modifiedContent.replace(linkRegex, `$1${dataUri}$2`);

            // URL references
            const urlRegex = new RegExp(
              `(src="|href="|url\\(|@import ['"]?)${fileNameEscaped}(['"]?\\)|["'])`,
              "g"
            );
            modifiedContent = modifiedContent.replace(urlRegex, `$1${dataUri}$2`);
          } catch (err) {
            console.error(`Error converting ${fileName} to data URI:`, err);
          }
        }

        return modifiedContent;
      } catch (error) {
        console.error("Error embedding media:", error);
        return content; // Return original content if there was an error
      }
    },

    isMediaFile(fileName) {
      const mediaExtensions = [
        // Images
        ".jpg",
        ".jpeg",
        ".png",
        ".gif",
        ".svg",
        ".webp",
        ".bmp",
        // Audio
        ".mp3",
        ".wav",
        ".ogg",
        ".m4a",
        // Video
        ".mp4",
        ".webm",
        ".ogv",
        ".mov",
      ];

      const extension = "." + fileName.split(".").pop().toLowerCase();
      return mediaExtensions.includes(extension);
    },

    getMimeType(fileName) {
      const extension = fileName.split(".").pop().toLowerCase();

      const mimeTypes = {
        // Images
        jpg: "image/jpeg",
        jpeg: "image/jpeg",
        png: "image/png",
        gif: "image/gif",
        svg: "image/svg+xml",
        webp: "image/webp",
        bmp: "image/bmp",
        // Audio
        mp3: "audio/mpeg",
        wav: "audio/wav",
        ogg: "audio/ogg",
        m4a: "audio/mp4",
        // Video
        mp4: "video/mp4",
        webm: "video/webm",
        ogv: "video/ogg",
        mov: "video/quicktime",
      };

      return mimeTypes[extension] || "application/octet-stream";
    },

    blobToDataUri(blob, mimeType) {
      return new Promise((resolve, reject) => {
        // Use FileReader's built-in base64 encoding
        const reader = new FileReader();

        reader.onload = function () {
          resolve(reader.result);
        };

        reader.onerror = function () {
          reject(new Error("Failed to convert file to data URI"));
        };

        reader.readAsDataURL(new Blob([blob], { type: mimeType }));
      });
    },

    publishToNostr() {
      if (!this.publicKey || !this.privateKey) {
        alert(this.$t('nostr.alertMissingKeys'));
        return;
      }

      if (this.relays.length === 0) {
        alert(this.$t('nostr.alertMissingRelay'));
        return;
      }

      this.saveCredentials();
      this.saveRelays();

      this.publishStatus = "loading";

      const database = new Dexie();
      const meta = database.get(this.storageId);
      const config = Utils.loadConfig();

      const yDoc = new Y.Doc();
      const provider = new IndexeddbPersistence(this.storageId, yDoc);

      provider.on("synced", async (_: any) => {
        try {
          const metaData = await meta;
          let contentData = yDoc.getText(this.storageId).toJSON();

          // Embed media if option is checked
          if (this.embedMedia) {
            contentData = await this.embedMediaAsDataURIs(contentData);
          }

          const pool = new SimplePool();
          const relays = [...this.relays];

          let pubkey;
          try {
            const decoded = nip19.decode(this.publicKey);
            pubkey = decoded.data;
          } catch (e) {
            console.error("Error decoding public key:", e);
            alert(this.$t('nostr.alertInvalidKey'));
            return;
          }

          const title = metaData?.title || "LiaScript Course";
          let tags = [
            ["d", this.storageId],
            ["title", title],
            ["summary", this.customMessage || "LiaScript course material"],
            ...this.tags.map((tag) => ["t", tag]),
          ];

          if (this.imageUrl) {
            tags.push(["image", this.imageUrl]);
          }

          const event: {
            kind: number;
            pubkey: string;
            created_at: number;
            tags: any[];
            content: string;
            id?: string;
          } = {
            kind: 30023,
            pubkey: pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags,
            content: contentData,
          };

          if (this.privateKey) {
            try {
              const decoded = nip19.decode(this.privateKey);
              const privkey = decoded.data;

              event.id = getEventHash(event);
              const signedEvent = finalizeEvent(event, privkey);

              const pubs = pool.publish(relays, signedEvent);

              await Promise.any(pubs);

              const naddr = nip19.naddrEncode({
                kind: 30023,
                pubkey: pubkey,
                identifier: this.storageId,
                relays: relays,
              });

              this.publishedCourseUrl = `https://liascript.github.io/course/?nostr:${naddr}`;

              this.step = "success";
              this.publishStatus = "success";

              this.privateKey = "";
            } catch (e) {
              console.error("Error publishing:", e);
              alert(this.$t('nostr.alertPublishFailed'));
              this.publishStatus = "failed";
            }
          } else {
            alert(this.$t('nostr.alertMissingPrivateKey'));
            this.publishStatus = null;
          }
        } catch (error) {
          console.error("Error processing data:", error);
          alert(this.$t('nostr.alertProcessingError'));
          this.publishStatus = "failed";
        } finally {
          provider.destroy();
          yDoc.destroy();
        }
      });
    },
  },
};
</script>

<style scoped>
.nostr-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 2000;
  display: flex;
  align-items: flex-start; /* Changed from center to flex-start */
  justify-content: center;
  padding: 1rem; /* Add padding for small screens */
}

.modal-backdrop {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
}

.modal-container {
  position: relative;
  width: 90%;
  max-width: 600px;
  max-height: 90vh; /* Limit height to 90% of viewport height */
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 2001;
  margin: 2rem 0; /* Add margin top/bottom */
  display: flex;
  flex-direction: column; /* Add flex layout */
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid #dee2e6;
}

.modal-body {
  padding: 1.5rem;
  overflow-y: auto; /* Make the body scrollable */
  flex: 1; /* Allow body to take remaining space */
}

.nostr-actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 1.5rem;
}

.tags-container {
  min-height: 38px;
  padding: 0.25rem 0;
}

.tags-container .badge {
  display: inline-flex;
  align-items: center;
  padding: 0.4rem 0.6rem;
}

.tags-container .btn-close {
  padding: 0.25rem;
  margin-left: 0.5rem;
  font-size: 0.75rem;
}

/* Dark mode support */
@media (prefers-color-scheme: dark) {
  .modal-container {
    background-color: #343a40;
    color: #f8f9fa;
  }

  .modal-header {
    border-bottom-color: #495057;
  }

  .btn-close {
    filter: invert(1) grayscale(100%) brightness(200%);
  }
}
</style>
