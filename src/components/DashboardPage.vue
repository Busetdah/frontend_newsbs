<script>
import { useRouter } from 'vue-router'

export default {
  name: 'DashboardPage',
  setup() {
    const router = useRouter()
    function navigateToSSD() {
      router.push('/smartstitchdetectionpage')
    }
    return { navigateToSSD }
  },
}
</script>

<template>
  <div class="bg-white">
    <div class="header">
      <img class="petro" src="../assets/petro.png" alt="" />
      <img class="gudang" src="../assets/gudang.png" alt="" />
      <img class="pelabuhan" src="../assets/gudang.png" alt="" />
    </div>
    <div class="tengah">
      <img class="sbe" src="../assets/sbe.png" />
      <p class="desc">Departemen Pergudangan & Pengantongan</p>
    </div>
    <div class="menu">
      <p class="md">Management Dashboard</p>
      <div class="button-links">
        <button>Smart Bagging System</button>
        <button @click="navigateToSSD">Smart Stitch Detection</button>
        <button>Early Warning System</button>
        <button>APD Detection</button>
        <button>Visual Product Quality</button>
        <button>Smart CCR</button>
        <button>Robo Safety</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter+Tight:ital,wght@0,100..900;1,100..900&display=swap');
* {
  font-family: 'Inter Tight', sans-serif;
  font-optical-sizing: auto;
}
.bg-white {
  background-color: #ffffff;
}
.header {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 30px;
  padding: 10px 0;
  margin-top: 5vh;
}
.petro {
  width: 11vw;
}
.gudang {
  width: 11vw;
}
.pelabuhan {
  width: 11vw;
}
.tengah {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 50vh;
}
.sbe {
  width: 37vw;
  margin-bottom: 40px;
}
.desc {
  font-size: 1.9vw;
  font-weight: 500;
  font-style: normal;
  text-align: center;
  margin-top: -5vh;
  color: #000000;
}
.md {
  font-size: 1.7vw;
  font-weight: 400;
  font-style: normal;
  text-align: center;
  margin-top: -5vh;
  color: #000000;
}
.menu {
  margin-top: 2vw;
}
.button-links {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1.2vw;
  margin: 2vh 20vw 0 20vw;
}
.button-links button {
  background-color: #2c2c2c;
  color: #ffffff;
  border: none;
  border-radius: 20px;
  font-size: 1.1vw;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    background-color 0.2s ease;
  width: 13vw;
  height: 7vh;
  text-align: center;
}
.button-links button:hover {
  background-color: #1a1a1a;
  transform: scale(1.03);
}
</style>
