<template>
    <nav class="navbar navbar-expand-lg navbar-light bg-light">
        <div class="container-fluid">
            <a class="navbar-brand" href="./" data-link="">
                Lia[Examples]
            </a>
        </div>
    </nav>

    <div class="container mt-4">
        <div id="card-container" class="row row-cols-1 row-cols-md-2 g-4">
            <div v-for="item of examples" class="col-sm-6 mb-4">
                <div class="card h-100 shadow bg-body rounded">
                    <img :src="item.logo" class="card-img-top img-fluid" style="height: 16rem; object-fit: cover;">
                    <div class="card-body">
                        <h5 class="card-title">{{ item.title }}</h5>
                        <p class="card-text">{{ item.info }}</p>
                        <a :href="'./?/show/file/'+item.link" class="stretched-link">Show</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>
  
<script lang="ts">
    interface Example {
        title: string;
        info: string;
        link: string;
        logo: string;    
    }

    export default {
        name: "Examples",
        //props: ['examples'],
        data() {
            return {
                examples: []
            }
        },
        methods: {
            init: function (examples: Example[]) {
                for (let i = 0; i < examples.length; i++) {
                    this.examples.push(examples[i])
                }
            }    
        },
        expose: ['init']
    };
</script>