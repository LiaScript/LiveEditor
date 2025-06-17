<script lang="ts">
import LiaScript from "./LiaScript.vue";
import Toast from "../components/Toast.vue";
import { LiaScriptURL, LiveEditorURL } from "../ts/utils";

function errorMsg(url: string, response: string) {
  return `# Ups, something went wrong
  
The following resource with the URL:

${url}

could not be loaded.

It responded with the following error message:

\`${response}\`

**Reasons:**

* The URL is wrong or the resource is not available anymore.
* Or, you are offline...`;
}

function replaceURLs(base: string, code: string): string {
  return code.replace(
    /(\[[^\]]*\]\()(?!(http:|https:|ipfs:|#|\/\/))\.?\/?([^\)]+)/g,
    `$1${base}$3`
  );
}

function replaceMacroURLs(macro: string, base: string, code: string): string {
  // Use the macro parameter to define the script path regex
  const scriptPathRegex = new RegExp(`${macro}:\\s*(.+?)(?=\\n|$)`, "g");

  // Regex to find HTML comments
  const htmlCommentRegex = /<!--([\s\S]*?)-->/g;

  // Loop through all HTML comments
  return code.replace(htmlCommentRegex, (commentMatch, commentContent) => {
    // Loop through all script paths within the comment
    return commentMatch.replace(scriptPathRegex, (scriptMatch, scriptPath) => {
      // Check if the script path needs the base URL added
      if (!/^(http|https|ipfs):/.test(scriptPath.trim())) {
        return `${macro}: ${base}${scriptPath.trim()}`;
      }
      return scriptMatch;
    });
  });
}

const defaultRelays = ["wss://relay.damus.io", "wss://relay.nostr.band", "wss://nos.lol"];

async function fetchNostrContent(url: string): Promise<string> {
  const nostrTools = await import("nostr-tools");
  const pool = new nostrTools.SimplePool();

  try {
    // Parse the URI to get the Nostr identifier
    const identifier = url.substring(6); // Remove 'nostr:'
    const decoded = nostrTools.nip19.decode(identifier);

    let fetchedEvent;
    switch (decoded.type) {
      case "note":
        fetchedEvent = await pool.get(defaultRelays, {
          ids: [decoded.data],
        });
        break;

      case "nevent":
        const relays = decoded.data.relays || defaultRelays;
        fetchedEvent = await pool.get(relays, {
          ids: [decoded.data.id],
        });
        break;

      case "naddr":
        fetchedEvent = await pool.get(decoded.data.relays, {
          kinds: [decoded.data.kind],
          authors: [decoded.data.pubkey],
          "#d": [decoded.data.identifier],
        });
        break;

      default:
        throw new Error("Unknown Nostr identifier type: " + decoded.type);
    }

    if (!fetchedEvent) {
      throw new Error("Content not found on specified relays");
    }

    return fetchedEvent.content;
  } catch (error) {
    throw new Error(`Error fetching Nostr content: ${error.message}`);
  } finally {
    pool.close(defaultRelays);
  }
}

export default {
  name: "LiaScript-FileView",
  props: ["fileUrl", "embed", "mode"],
  data() {
    let embed = this.$props.embed || false;

    return {
      embed,
      data: undefined,
      LiaScriptURL,
      LiveEditorURL,
    };
  },

  // Modify the created hook
  async created() {
    try {
      if (this.fileUrl.startsWith("nostr:")) {
        this.data = await fetchNostrContent(this.fileUrl);
      } else {
        const response = await fetch(this.fileUrl);
        if (response.ok) {
          this.data = await response.text();
          const baseURL = this.fileUrl.replace(/\/[^\/]*$/, "/");
          this.data = replaceURLs(baseURL, this.data);
          this.data = replaceMacroURLs("script", baseURL, this.data);
          this.data = replaceMacroURLs("link", baseURL, this.data);
        } else {
          this.data = errorMsg(
            this.fileUrl,
            response.status + ": " + response.statusText
          );
        }
      }
    } catch (error) {
      this.data = errorMsg(this.fileUrl, error.message);
    }
  },
  components: { LiaScript, Toast },
};
</script>

<template>
  <LiaScript v-if="data" :content="data" :file-url="fileUrl" :embed="embed" :mode="mode">
  </LiaScript>

  <Toast v-if="!embed">
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>, but if you
    want to store your changes permanently you have to fork it!

    <br />
    If you want to see the course on LiaScript, click
    <a :href="LiaScriptURL + '?' + fileUrl" target="_blank">here</a>.
  </Toast>

  <Toast v-else>
    You can modify and compile this course with <kbd>Ctrl</kbd>+<kbd>S</kbd>
    <br />
    ... or, open it in the
    <a :href="LiveEditorURL + '?/show/file/' + fileUrl" target="_blank">LiveEditor</a>
    ...
    <br />
    If you want to see the course on LiaScript, click
    <a :href="LiaScriptURL + '?' + fileUrl" target="_blank">here</a>.

    <div v-if="mode">
      <hr />
      Use toolbar to switch between the editor and preview modes.
    </div>
  </Toast>
</template>
