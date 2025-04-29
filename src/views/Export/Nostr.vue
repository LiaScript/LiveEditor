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
          <h6>Nostr Key</h6>
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

          <div class="form-check mb-3" v-if="publicKey">
            <input
              class="form-check-input"
              type="checkbox"
              id="rememberKey"
              v-model="rememberKey"
            />
            <label class="form-check-label" for="rememberKey">
              Remember my public key for future posts
            </label>
          </div>

          <div v-if="privateKey" class="alert alert-warning">
            <div class="d-flex align-items-center mb-2">
              <i class="bi bi-exclamation-triangle-fill me-2"></i>
              <strong>Important: Save your private key</strong>
            </div>
            <p class="mb-2">
              This private key gives access to your Nostr identity. Save it securely.
            </p>
            <div class="input-group">
              <input
                :type="privateKeyVisible ? 'text' : 'password'"
                class="form-control"
                v-model="privateKey"
                readonly
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
              >
                <i class="bi bi-clipboard"></i>
              </button>
            </div>
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
              :disabled="!publicKey"
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
          <h5>Successfully Published!</h5>
          <p>Your course has been shared to the Nostr network.</p>
          <button class="btn btn-primary" @click="close">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { generateSecretKey, getPublicKey, nip19 } from "nostr-tools";

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

      // Nostr key management
      publicKey: "",
      privateKey: "",
      rememberKey: true,
      privateKeyVisible: false,
    };
  },

  created() {
    // Try to load saved public key from localStorage
    const savedPublicKey = localStorage.getItem("nostrPublicKey");
    if (savedPublicKey) {
      this.publicKey = savedPublicKey;
    }
  },

  computed: {
    nostrUrl() {
      return this.courseUrl;
    },
  },

  methods: {
    close() {
      // Clear generated private key when closing the modal for security
      this.privateKey = "";
      this.privateKeyVisible = false;
      this.$emit("close");
    },

    generateKeyPair() {
      try {
        // Generate a new private key (using the correct function name)
        const privateKey = generateSecretKey();

        // Derive the public key from it
        const publicKey = getPublicKey(privateKey);

        // Convert to human-readable formats (npub, nsec)
        const npub = nip19.npubEncode(publicKey);
        const nsec = nip19.nsecEncode(privateKey);

        this.privateKey = nsec;
        this.publicKey = npub;
        this.privateKeyVisible = true;
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
      if (!this.publicKey) {
        alert("Please enter your public key or generate a new one before publishing.");
        return;
      }

      // Store public key if requested
      if (this.rememberKey) {
        localStorage.setItem("nostrPublicKey", this.publicKey);
      } else {
        localStorage.removeItem("nostrPublicKey");
      }

      // Here we would implement the actual Nostr publishing logic
      // This would use the nostr-tools library to:
      // 1. Creating a Nostr event with course link
      // 2. Signing it with the user's private key (if available)
      // 3. Publishing to relays

      // For now, we'll just simulate success
      setTimeout(() => {
        this.step = "success";
        // Clear private key after successful publish for security
        this.privateKey = "";
      }, 1000);
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
