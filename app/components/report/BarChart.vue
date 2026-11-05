<script setup lang="ts">
import { BarElement, CategoryScale, Chart as ChartJS, Legend, LinearScale, Tooltip } from 'chart.js'
import { Bar } from 'vue-chartjs'

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip, Legend)

const props = defineProps<{ labels: string[], datasets: { label: string, data: number[], color?: string }[], horizontal?: boolean, money?: boolean, height?: number }>()
const colorMode = useColorMode()
const PALETTE = ['#4F46E5', '#12B76A', '#F79009', '#7A5AF8', '#0EA5E9', '#F04438']
const data = computed(() => ({
  labels: props.labels,
  datasets: props.datasets.map((d, i) => ({ label: d.label, data: d.data, backgroundColor: d.color ?? PALETTE[i % PALETTE.length], borderRadius: 4, maxBarThickness: 32 })),
}))
const grid = computed(() => (colorMode.value === 'dark' ? '#26282D' : '#EEEFF1'))
const text = computed(() => (colorMode.value === 'dark' ? '#9AA0AA' : '#5A606B'))
const fmt = (v: number | string) => (props.money ? `${Number(v).toLocaleString('ru-RU')} ₸` : Number(v).toLocaleString('ru-RU'))
const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: props.horizontal ? 'y' as const : 'x' as const,
  animation: { duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 400 },
  plugins: { legend: { display: props.datasets.length > 1, labels: { color: text.value, boxWidth: 10 } }, tooltip: { callbacks: { label: (c: { dataset: { label?: string }, raw: unknown }) => `${c.dataset.label}: ${fmt(c.raw as number)}` } } },
  scales: {
    x: { grid: { color: props.horizontal ? grid.value : 'transparent' }, ticks: { color: text.value, callback: props.horizontal ? (v: number | string) => fmt(v) : undefined } },
    y: { grid: { color: props.horizontal ? 'transparent' : grid.value }, ticks: { color: text.value, callback: props.horizontal ? undefined : (v: number | string) => fmt(v) } },
  },
}))
</script>

<template>
  <div :style="{ height: `${height ?? 260}px` }">
    <Bar
      :data="data"
      :options="options as never"
    />
  </div>
</template>
