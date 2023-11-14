<script>
import LiaScript from "./LiaScript.vue";

export default {
  name: "LiaScript-EditView",
  props: ["storageId"],
  components: { LiaScript },
};
</script>

<template>
  <LiaScript :storage-id="storageId"></LiaScript>
</template>