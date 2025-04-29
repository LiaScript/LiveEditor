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
  },

  computed: {
    nostrUrl() {
      return this.courseUrl;
    },
  },

  methods: {
    close() {
      // Save credentials if requested
      this.saveCredentials();

      // Reset states
      this.isNewlyGenerated = false;
      this.privateKeyVisible = false;
      this.step = "initial";

      this.$emit("close");
    },

    generateKeyPair() {
      try {
        // Generate a new private key
        const privateKey = generateSecretKey();

        // Derive the public key from it
        const publicKey = getPublicKey(privateKey);

        // Convert to human-readable formats (npub, nsec)
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
      navigator.clipboard.writeText(text).then(() => {
        // Could show a small toast notification here
      });
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

    publishToNostr() {
      if (!this.publicKey || !this.privateKey) {
        alert("Please enter both your public and private keys before publishing.");
        return;
      }

      // Save credentials if requested
      this.saveCredentials();

      // Loading indicator could be added here
      this.publishStatus = "loading";

      const database = new Dexie();
      const meta = database.get(this.storageId);
      const config = Utils.loadConfig();

      const yDoc = new Y.Doc();
      const provider = new IndexeddbPersistence(this.storageId, yDoc);

      provider.on("synced", async (_: any) => {
        try {
          const metaData = await meta;
          const contentData = yDoc.getText(this.storageId).toJSON();

          console.log("Content Data:", contentData);
          console.log("Meta Data:", metaData);

          // 1. Create a pool for relays
          const pool = new SimplePool();
          const relays = [
            "wss://relay.damus.io",
            "wss://relay.nostr.band",
            "wss://nos.lol",
          ];

          // 2. Decode the user's public key from npub format
          let pubkey;
          try {
            const decoded = nip19.decode(this.publicKey);
            pubkey = decoded.data;
          } catch (e) {
            console.error("Error decoding public key:", e);
            alert("Invalid public key format");
            return;
          }

          // 3. Prepare content
          const title = metaData?.title || "LiaScript Course";

          // 4. Create the event (NIP-33 parameterized replaceable event)
          const event = {
            kind: 30023, // Long-form content
            pubkey: pubkey,
            created_at: Math.floor(Date.now() / 1000),
            tags: [
              ["d", this.storageId], // Use storageId as identifier
              ["title", title],
              ["summary", metaData?.description || "LiaScript course material"],
              ...this.tags.map((tag) => ["t", tag]),
            ],
            content: contentData,
          };

          // 5. If user has provided private key, sign and publish
          if (this.privateKey) {
            try {
              // Decode private key
              const decoded = nip19.decode(this.privateKey);
              const privkey = decoded.data;

              // Sign the event - updated approach for newer nostr-tools
              event.id = getEventHash(event);
              const signedEvent = finalizeEvent(event, privkey);

              // Publish to relays
              console.log("Publishing event:", signedEvent);

              const pubs = pool.publish(relays, signedEvent);

              // Wait for at least one successful publish
              await Promise.any(pubs);

              // Create the naddr representation
              const naddr = nip19.naddrEncode({
                kind: 30023,
                pubkey: pubkey,
                identifier: this.storageId,
                relays: relays,
              });

              // Set the published course URL
              this.publishedCourseUrl = `https://liascript.github.io/course/?nostr:${naddr}`;

              console.log("Published as naddr:", "nostr:" + naddr);
              console.log("Published course URL:", this.publishedCourseUrl);

              // Success!
              this.step = "success";
              this.publishStatus = "success";

              // Clear private key after successful publish for security
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
          // Clean up
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
