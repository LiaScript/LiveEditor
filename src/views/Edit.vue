<script>
import LiaScript from "./LiaScript.vue";

const Component = {
  name: "LiaScript-EditView",
  props: ["storageId"],
  components: { LiaScript },
};

export default Component;
</script>

<template>
  <LiaScript :storage-id="storageId"></LiaScript>
</template>