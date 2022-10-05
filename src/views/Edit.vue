<template>
  <LiaScript :storage-id="storageId"></LiaScript>
</template>

<script>
import LiaScript from "./LiaScript.vue";

export default {
  props: ["storageId"],
  data() {
    return {};
  },
  components: { LiaScript },
};
</script>