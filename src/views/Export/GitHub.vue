<script lang="ts">
import Dexie from "../../ts/indexDB";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import * as GitHub from "../../ts/GitHub";
import * as Utils from "../../ts/utils";

export default {
  props: ["stepId1", "code", "stepId2"],

  methods: {
    step1(id: string) {
      const config = Utils.loadConfig();

      if (!config.credentials?.github && id) {
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
        const metaData = await meta;
        const contentData = yDoc.getText(id).toJSON();

        if (!config.credentials?.github) {
          config.credentials.github = await GitHub.access_token(code);
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
          window.location.reload();
        }

        if (metaData.meta.gist_id != gist.id) {
          await database.put(id, {
            gist_id: gist.id,
            gist_url: gist.raw_url,
          });
        }

        window.location.href = gist.url;
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

<template>Exporting</template>
