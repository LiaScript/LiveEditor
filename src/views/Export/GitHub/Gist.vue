<script lang="ts">
import Dexie from "../../../ts/indexDB";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import * as GitHub from "../../../ts/Gist";
import * as Utils from "../../../ts/utils";

export default {
  props: ["stepId1", "code", "stepId2"],

  data() {
    return {
      message: "",
    };
  },

  methods: {
    step1(id: string) {
      const config = Utils.loadConfig();

      if (!config.credentials?.github?.scope && id) {
        GitHub.authorize(id);
      } else {
        this.step2(id);
      }
    },

    step2(id: string, code: string) {
      const database = new Dexie();
      const meta = database.get(id);
      const config = Utils.loadConfig();

      const yDoc = new Y.Doc();
      const provider = new IndexeddbPersistence(id, yDoc);

      provider.on("synced", async (_: any) => {
        try {
          const metaData = await meta;
          const contentData = yDoc.getText(id).toJSON();

          if (!config.credentials?.github?.scope) {
            const credentials = await GitHub.access_token(code);

            // could not obtain a token (e.g. expired/invalid OAuth code)
            if (credentials?.error) {
              config.credentials.github = undefined;
              Utils.storeConfig(config);

              this.message = this.$t('github.error') + "\n" + credentials.message;
              return;
            }

            config.credentials.github = credentials;
            Utils.storeConfig(config);
          }

          const gist = await GitHub.gistUpload(
            config.credentials.github,
            metaData.meta.title,
            metaData.meta.macro?.comment || "",
            contentData,
            metaData.meta.gist_id
          );

          if (gist.error == "Bad credentials") {
            config.credentials.github = undefined;
            Utils.storeConfig(config);

            this.message = this.$t('github.badCredentials');

            window.location.reload();
            return;
          }

          // any other upload/network error: show it instead of hanging
          if (gist.error) {
            this.message = this.$t('github.error') + "\n" + gist.message;
            return;
          }

          if (metaData.meta.gist_id != gist.id) {
            await database.put(id, {
              gist_id: gist.id,
              gist_url: gist.raw_url,
            });
          }

          this.message = gist.message;

          if (gist.url) {
            window.location.href = gist.url;
          }
        } catch (e) {
          console.warn(e);
          this.message = this.$t('github.error') + "\n" + (e?.message || e);
        }
      });
    },
  },

  async created() {
    if (this.$props.stepId1) {
      this.step1(this.$props.stepId1);
    } else if (this.$props.stepId2) {
      this.step2(this.$props.stepId2, this.$props.code);
    }
  },
};
</script>

<template>
  {{ $t('github.exporting') }}

  <p>{{ message }}</p>
</template>

<style scoped>
p {
  margin-top: 20px;
  white-space: pre-line;
}
</style>
