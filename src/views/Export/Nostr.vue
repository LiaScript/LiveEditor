<template>
  <div class="nostr-modal" v-if="visible">
    <div class="modal-backdrop" @click="close"></div>
    <div class="modal-container">
      <div class="modal-header">
        <h5 class="modal-title">Share via Nostr</h5>
        <button
          type="button"
          class="btn-close"
          @click="close"
          aria-label="Close"
        ></button>
      </div>
      <div class="modal-body">
        <!-- Key Management Section -->
        <div v-if="step === 'initial'" class="key-management mb-4">
          <h6>Nostr Keys</h6>

          <!-- Public Key -->
          <div class="form-group mb-3">
            <label for="nostrPublicKey" class="form-label">Your Public Key (npub):</label>
            <div class="input-group">
              <input
                id="nostrPublicKey"
                type="text"
                class="form-control"
                v-model="publicKey"
                placeholder="Enter your Nostr public key (npub...)"
              />
              <button
                class="btn btn-outline-secondary"
                @click="generateKeyPair"
                title="Generate a new key pair"
              >
                <i class="bi bi-key"></i> Generate New
              </button>
            </div>
            <div class="form-text text-muted">
              Your public key is used to identify you on the Nostr network.
            </div>
          </div>

          <!-- Private Key (always visible) -->
          <div class="form-group mb-3">
            <label for="nostrPrivateKey" class="form-label"
              >Your Private Key (nsec):</label
            >
            <div class="input-group">
              <input
                id="nostrPrivateKey"
                :type="privateKeyVisible ? 'text' : 'password'"
                class="form-control"
                v-model="privateKey"
                placeholder="Enter your Nostr private key (nsec...)"
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
                title="Copy to clipboard"
                :disabled="!privateKey"
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
            <div class="form-text text-muted">
              Your private key is needed to sign and publish posts. Keep it secure.
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
              Store credentials in this browser
            </label>
            <div class="form-text text-warning">
              <i class="bi bi-exclamation-triangle-fill me-1"></i>
              Storing your private key in the browser is convenient but less secure.
            </div>
          </div>

          <!-- Relay Configuration -->
          <div class="form-group mb-3 mt-4">
            <label for="nostrRelays" class="form-label">Relay Servers:</label>
            <textarea
              id="nostrRelays"
              class="form-control"
              rows="3"
              v-model="relaysText"
              placeholder="Enter relay servers (one per line)"
            ></textarea>
            <div class="form-text text-muted">
              Enter relay servers (one per line) to publish your content to.
            </div>
            <div class="form-check mt-2">
              <input
                class="form-check-input"
                type="checkbox"
                id="storeRelays"
                v-model="storeRelays"
              />
              <label class="form-check-label" for="storeRelays">
                Remember these relays for future posts
              </label>
            </div>
          </div>

          <!-- Warning box when keys are generated -->
          <div v-if="isNewlyGenerated" class="alert alert-warning">
            <div class="d-flex align-items-center mb-2">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Important: Save your private key</strong>
            </div>
            <p class="mb-2">
              This private key gives access to your Nostr identity. Save it securely.
            </p>
          </div>
        </div>

        <div v-if="step === 'initial'" class="initial-view">
          <p>
            Share your course with the Nostr community. You can publish directly or
            customize your post first.
          </p>

          <div class="form-group mb-3">
            <label for="nostrUrl" class="form-label">Nostr link for your course:</label>
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
                title="Copy to clipboard"
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
              Embed media files as data URIs
            </label>
            <div class="form-text text-muted">
              Converts images, audio, and video files to embedded data URIs for better
              portability.
            </div>
          </div>

          <div class="nostr-actions">
            <button class="btn btn-outline-primary me-2" @click="step = 'customize'">
              <i class="bi bi-pencil-square me-1"></i> Customize Post
            </button>
            <button
              class="btn btn-primary"
              @click="publishToNostr"
              :disabled="!publicKey || !privateKey"
            >
              <i class="bi bi-lightning-charge me-1"></i> Publish Now
            </button>
          </div>
        </div>

        <div v-if="step === 'customize'" class="customize-view">
          <div class="form-group mb-3">
            <label for="nostrMessage" class="form-label">Message (optional):</label>
            <textarea
              id="nostrMessage"
              class="form-control"
              rows="3"
              v-model="customMessage"
              placeholder="Add a message to accompany your Nostr post..."
            ></textarea>
          </div>

          <div class="form-group mb-3">
            <label class="form-label d-block">Tags:</label>
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
                placeholder="Add a tag..."
                v-model="newTag"
                @keydown.enter.prevent="addTag"
              />
              <button class="btn btn-outline-secondary" @click="addTag">Add</button>
            </div>
          </div>

          <div class="nostr-actions">
            <button class="btn btn-outline-secondary me-2" @click="step = 'initial'">
              <i class="bi bi-arrow-left me-1"></i> Back
            </button>
            <button
              class="btn btn-primary"
              @click="publishToNostr"
              :disabled="!publicKey"
            >
              <i class="bi bi-lightning-charge me-1"></i> Publish to Nostr
            </button>
          </div>
        </div>

        <div v-if="step === 'success'" class="success-view text-center">
          <div class="mb-3">
            <i class="bi bi-check-circle-fill text-success" style="font-size: 3rem"></i>
          </div>
          <h5>Your course is now published!</h5>

          <div class="form-group mb-4">
            <label class="form-label">Access your course at:</label>
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
                title="Copy to clipboard"
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
          </div>

          <div class="mt-3 d-flex justify-content-between">
            <a :href="publishedCourseUrl" target="_blank" class="btn btn-primary">
              <i class="bi bi-box-arrow-up-right me-1"></i> Open Course
            </a>
            <button class="btn btn-outline-secondary" @click="close">Close</button>
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
        alert("Failed to generate key pair. Please try again.");
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
        alert("Please enter both your public and private keys before publishing.");
        return;
      }

      if (this.relays.length === 0) {
        alert("Please enter at least one relay server.");
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
            alert("Invalid public key format");
            return;
          }

          const title = metaData?.title || "LiaScript Course";

          const event = {
            kind: 30023,
            pubkey: pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["d", this.storageId],
              ["title", title],
              ["summary", metaData?.description || "LiaScript course material"],
              ...this.tags.map((tag) => ["t", tag]),
            ],
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
              alert("Failed to publish to Nostr network. Please try again.");
              this.publishStatus = "failed";
            }
          } else {
            alert("Please provide your private key to sign and publish the post.");
            this.publishStatus = null;
          }
        } catch (error) {
          console.error("Error processing data:", error);
          alert("Error processing document data.");
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
  align-items: center;
  justify-content: center;
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
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  z-index: 2001;
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
