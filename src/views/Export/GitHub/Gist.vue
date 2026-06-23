<script lang="ts">
import Dexie from "../../../ts/indexDB";
import { getProjectDoc, releaseProjectDoc } from "../../../ts/ProjectDoc";
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

    async step2(id: string, code?: string) {
      const database = new Dexie();
      const config = Utils.loadConfig();

      // Reuse the shared ProjectDoc so we can read any file in the project, not
      // just the main course text. The file to export was persisted as
      // `gist_export_path` before this page was opened (see LiaScript.githubGist),
      // which also lets it survive the GitHub OAuth round-trip.
      const doc = getProjectDoc(id);

      try {
        await doc.idb.whenSynced;
        const metaData = await database.get(id);

        // The file to export was persisted as the resolved preview path; fall
        // back to the main document when it is missing (e.g. legacy links).
        const path: string = metaData?.meta?.gist_export_path || doc.getMainPath();
        const isMain = doc.isMain(path);
        const contentData = doc.getText(path).toString();

        if (!config.credentials?.github?.scope) {
          const credentials = await GitHub.access_token(code || "");

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

        // Sub-files are named after their file (without extension); the main
        // document keeps the project title.
        const base = path.split("/").pop() || path;
        const title = isMain ? metaData.meta.title : base.replace(/\.[^.]+$/, "") || base;

        // One gist per exported file so multiple files in a project don't
        // overwrite each other; fall back to the legacy project-level gist_id
        // for the main document.
        const gistFiles = metaData.meta.gist_files || {};
        const existingId =
          gistFiles[path]?.id ?? (isMain ? metaData.meta.gist_id : undefined);

        const gist = await GitHub.gistUpload(
          config.credentials.github,
          title,
          metaData.meta.macro?.comment || "",
          contentData,
          existingId
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

        gistFiles[path] = {
          id: gist.id,
          raw_url: gist.raw_url,
          url: gist.url,
        };
        const update: any = { gist_files: gistFiles };
        // keep the legacy project-level fields in sync for the main document
        if (isMain) {
          update.gist_id = gist.id;
          update.gist_url = gist.raw_url;
        }
        await database.put(id, update);

        this.message = gist.message;

        if (gist.url) {
          window.location.href = gist.url;
        }
      } catch (e: any) {
        console.warn(e);
        this.message = this.$t('github.error') + "\n" + (e?.message || e);
      } finally {
        releaseProjectDoc(id);
      }
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
