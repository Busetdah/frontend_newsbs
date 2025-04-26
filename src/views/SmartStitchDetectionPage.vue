<script>
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  ArcElement,
  PieController,
  Filler,
} from 'chart.js'
import * as XLSX from 'xlsx'

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  Title,
  CategoryScale,
  Tooltip,
  Legend,
  ArcElement,
  PieController,
  Filler,
)

// Get Jakarta date as YYYY-MM-DD - defined outside component
function getJakartaDateString() {
  const now = new Date()
  const utc = now.getTime() + now.getTimezoneOffset() * 60000
  const jakartaOffset = 7 * 60 * 60000 // 7 hours in milliseconds
  const jakartaTime = new Date(utc + jakartaOffset)
  return jakartaTime.toISOString().split('T')[0]
}

export default {
  name: 'SmartStitchDetectionPage',
  data() {
    // Get current Jakarta date for initialization
    const jakartaDate = getJakartaDateString()

    return {
      rawData: [],
      dailyData: [],
      summaryData: { good: 0, bad: 0, total: 0 },
      startDate: jakartaDate, // Initialize with Jakarta date
      endDate: jakartaDate, // Initialize with Jakarta date
      lineChart: null,
      pieChart: null,
      sse: null,
      mounted: false,
      isLoading: false,
      jakartaDateTimer: null,
    }
  },
  computed: {
    chartData() {
      const labels = this.rawData.map((d) => {
        // Parse the date string from the database
        const date = new Date(d.time)
        // Format it using 24-hour format (13:00, 18:00)
        return date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false, // This disables AM/PM and uses 24-hour format
        })
      })
      const good = this.rawData.map((d) => d.good)
      const bad = this.rawData.map((d) => d.bad)
      return { labels, good, bad }
    },
    goodStitch() {
      return this.summaryData.good
    },
    badStitch() {
      return this.summaryData.bad
    },
    totalStitch() {
      return this.summaryData.total
    },
    goodRate() {
      if (this.totalStitch === 0) return '0.00'
      return ((this.goodStitch / this.totalStitch) * 100).toFixed(2)
    },
  },
  created() {
    // Double check dates are set correctly on creation
    const jakartaDate = this.getJakartaDate()
    this.startDate = jakartaDate
    this.endDate = jakartaDate
  },
  mounted() {
    this.mounted = true

    // Force update both dates with current Jakarta time
    const jakartaDate = this.getJakartaDate()
    this.startDate = jakartaDate
    this.endDate = jakartaDate

    // Set up a timer to update the Jakarta date every minute
    this.jakartaDateTimer = setInterval(() => {
      this.endDate = this.getJakartaDate()
    }, 60000) // Update every minute

    if (typeof window !== 'undefined') {
      this.startSSE()
    }
  },
  beforeUnmount() {
    if (this.sse) this.sse.close()

    // Clear the timer when component is unmounted
    if (this.jakartaDateTimer) {
      clearInterval(this.jakartaDateTimer)
    }
  },
  watch: {
    startDate() {
      this.startSSE()
    },
    endDate() {
      this.startSSE()
    },
  },
  methods: {
    navigateHome() {
      if (this.$router) {
        this.$router.push('/')
      } else {
        window.location.href = '/'
      }
    },
    formatDate(date) {
      return date.toISOString().split('T')[0]
    },
    // Method to get current date in Jakarta timezone (GMT+7)
    getJakartaDate() {
      return getJakartaDateString()
    },
    setDateRange(range) {
      // Set loading state to true before changing dates
      this.isLoading = true

      // Get current Jakarta date
      const jakartaDateStr = this.getJakartaDate()
      // Parse as Date object for calculations
      const jakartaToday = new Date(jakartaDateStr)
      let start = new Date(jakartaToday)

      switch (range) {
        case 'today':
          this.startDate = jakartaDateStr
          this.endDate = jakartaDateStr
          break
        case 'lastWeek':
          start.setDate(jakartaToday.getDate() - 7)
          this.startDate = this.formatDate(start)
          this.endDate = jakartaDateStr
          break
        case 'lastMonth':
          start.setDate(jakartaToday.getDate() - 31)
          this.startDate = this.formatDate(start)
          this.endDate = jakartaDateStr
          break
      }

      // Loading state will be turned off in the onmessage handler of SSE
    },
    startSSE() {
      if (this.sse) this.sse.close()

      // Set loading state to true when starting a new connection
      this.isLoading = true

      // Clear current data to show loading state properly
      this.rawData = []
      this.summaryData = { good: 0, bad: 0, total: 0 }
      this.dailyData = []

      // Remove existing charts
      if (this.lineChart) this.lineChart.destroy()
      if (this.pieChart) this.pieChart.destroy()

      const base = import.meta.env.VITE_API_URL || ''
      const url = `${base}/api/ssd?start_date=${this.startDate}&end_date=${this.endDate}`

      this.sse = new EventSource(url)

      this.sse.onmessage = (e) => {
        const { data, summary, dailyData } = JSON.parse(e.data)
        this.rawData = data
        this.summaryData = summary
        this.dailyData = dailyData || this.processDailyData(data)

        // Turn off loading state when data is received
        this.isLoading = false

        this.$nextTick(() => {
          this.renderLineChart()
          this.renderPieChart()
        })
      }

      this.sse.onerror = () => {
        this.sse.close()
        // Turn off loading state in case of error
        this.isLoading = false
        setTimeout(() => this.startSSE(), 2000)
      }
    },
    processDailyData(data) {
      const dailyMap = new Map()

      data.forEach((entry) => {
        const date = new Date(entry.time).toISOString().split('T')[0]

        if (!dailyMap.has(date)) {
          dailyMap.set(date, { date, good: 0, bad: 0, total: 0 })
        }

        const dailyEntry = dailyMap.get(date)
        dailyEntry.good += entry.good || 0
        dailyEntry.bad += entry.bad || 0
        dailyEntry.total = dailyEntry.good + dailyEntry.bad
      })

      return Array.from(dailyMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date))
    },
    exportToExcel() {
      if (!this.dailyData || this.dailyData.length === 0) {
        alert('No data available to export')
        return
      }

      const exportData = this.dailyData.map((day) => ({
        Date: day.date,
        'Good Stitch': day.good,
        'Bad Stitch': day.bad,
        'Total Stitch': day.total,
        'Good Rate (%)': day.total > 0 ? ((day.good / day.total) * 100).toFixed(2) : '0.00',
      }))

      const worksheet = XLSX.utils.json_to_sheet(exportData)

      // Calculate column widths
      const columnWidths = []
      const headers = Object.keys(exportData[0])

      headers.forEach((header) => {
        columnWidths.push({ wch: header.length + 4 })
      })

      exportData.forEach((row) => {
        headers.forEach((header, i) => {
          const valueLength = String(row[header]).length
          if (valueLength + 4 > columnWidths[i].wch) {
            columnWidths[i].wch = valueLength + 4
          }
        })
      })

      worksheet['!cols'] = columnWidths

      // Apply center alignment
      const range = XLSX.utils.decode_range(worksheet['!ref'])

      for (let row = range.s.r; row <= range.e.r; row++) {
        for (let col = range.s.c; col <= range.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col })

          if (!worksheet[cellAddress]) continue

          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {}

          worksheet[cellAddress].s = {
            alignment: {
              horizontal: 'center',
              vertical: 'center',
              wrapText: true,
            },
            font: { bold: row === 0 },
            border: {
              top: { style: 'thin', color: { rgb: '000000' } },
              bottom: { style: 'thin', color: { rgb: '000000' } },
              left: { style: 'thin', color: { rgb: '000000' } },
              right: { style: 'thin', color: { rgb: '000000' } },
            },
          }
        }
      }

      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Stitch Data')

      const fileName = `Stitch_Data_${this.startDate}_to_${this.endDate}.xlsx`

      const wbOpts = {
        bookType: 'xlsx',
        bookSST: false,
        type: 'array',
        cellStyles: true,
      }

      XLSX.writeFile(workbook, fileName, wbOpts)
    },
    renderLineChart() {
      const canvas = this.$refs.lineChart
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (this.lineChart) this.lineChart.destroy()

      if (this.chartData.labels.length === 0) return

      this.lineChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: this.chartData.labels,
          datasets: [
            {
              label: 'Good Stitch',
              data: this.chartData.good,
              borderColor: '#4ade80',
              backgroundColor: 'rgba(74, 222, 128, 0.1)',
              tension: 0.4,
              fill: 'origin',
              borderWidth: 2,
              pointBackgroundColor: '#4ade80',
              pointRadius: 3,
            },
            {
              label: 'Bad Stitch',
              data: this.chartData.bad,
              borderColor: '#f87171',
              backgroundColor: 'rgba(248, 113, 113, 0.1)',
              tension: 0.4,
              fill: 'origin',
              borderWidth: 2,
              pointBackgroundColor: '#f87171',
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                boxWidth: 80,
                padding: 10,
                font: {
                  family: "'Inter', sans-serif",
                  size: 12,
                },
              },
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(17, 24, 39, 0.8)',
              titleFont: {
                family: "'Inter', sans-serif",
                size: 13,
              },
              bodyFont: {
                family: "'Inter', sans-serif",
                size: 12,
              },
              padding: 12,
              cornerRadius: 8,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: {
                color: 'rgba(0, 0, 0, 0.05)',
              },
              ticks: {
                font: {
                  family: "'Inter', sans-serif",
                  size: 11,
                },
              },
            },
            x: {
              grid: {
                display: false,
              },
              ticks: {
                font: {
                  family: "'Inter', sans-serif",
                  size: 11,
                },
              },
            },
          },
        },
      })
    },
    renderPieChart() {
      const canvas = this.$refs.pieChart
      if (!canvas) return

      const ctx = canvas.getContext('2d')
      if (!ctx) return

      if (this.pieChart) this.pieChart.destroy()

      const good = this.goodStitch
      const bad = this.badStitch

      if (good === 0 && bad === 0) return

      this.pieChart = new Chart(ctx, {
        type: 'pie',
        data: {
          labels: ['Good Stitch', 'Bad Stitch'],
          datasets: [
            {
              data: [good, bad],
              backgroundColor: ['#4ade80', '#f87171'],
              hoverBackgroundColor: ['#22c55e', '#ef4444'],
              borderWidth: 0,
              hoverOffset: 10,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                usePointStyle: true,
                padding: 20,
                font: {
                  family: "'Inter', sans-serif",
                  size: 12,
                },
              },
            },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(17, 24, 39, 0.8)',
              titleFont: {
                family: "'Inter', sans-serif",
                size: 13,
              },
              bodyFont: {
                family: "'Inter', sans-serif",
                size: 12,
              },
              padding: 12,
              cornerRadius: 8,
            },
          },
        },
      })
    },
  },
}
</script>

<template>
  <div class="dashboard stitch-detection-theme">
    <div class="dashboard-header">
      <div class="header-top">
        <div class="page-title-container">
          <h1>Stitch Detection</h1>
        </div>
        <div class="nav-buttons">
          <button @click="navigateHome" class="btn btn-home">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
              <polyline points="9 22 9 12 15 12 15 22"></polyline>
            </svg>
            Home
          </button>
        </div>
      </div>
      <div class="date-controls">
        <div class="date-control-section">
          <div class="date-picker-group">
            <div class="date-picker">
              <label>From</label>
              <input type="date" v-model="startDate" :disabled="isLoading" />
            </div>
            <div class="date-picker">
              <label>To</label>
              <input type="date" v-model="endDate" :disabled="isLoading" />
            </div>
          </div>
          <div class="date-quick-select">
            <button
              @click="setDateRange('today')"
              class="btn btn-quick"
              :class="{ 'btn-loading': isLoading }"
              :disabled="isLoading"
            >
              <span
                v-if="
                  isLoading &&
                  startDate === formatDate(new Date()) &&
                  endDate === formatDate(new Date())
                "
                class="loading-spinner"
              ></span>
              Today
            </button>
            <button
              @click="setDateRange('lastWeek')"
              in
              class="btn btn-quick"
              :class="{ 'btn-loading': isLoading }"
              :disabled="isLoading"
            >
              <span
                v-if="
                  isLoading &&
                  startDate === formatDate(new Date(new Date().setDate(new Date().getDate() - 7)))
                "
                class="loading-spinner"
              ></span>
              Last Week
            </button>
            <button
              @click="setDateRange('lastMonth')"
              class="btn btn-quick"
              :class="{ 'btn-loading': isLoading }"
              :disabled="isLoading"
            >
              <span
                v-if="
                  isLoading &&
                  startDate === formatDate(new Date(new Date().setDate(new Date().getDate() - 31)))
                "
                class="loading-spinner"
              ></span>
              Last Month
            </button>
          </div>
        </div>
        <button
          @click="exportToExcel"
          class="btn btn-export"
          :disabled="isLoading || !dailyData.length"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          Export Data
        </button>
      </div>
    </div>

    <div class="dashboard-content" :class="{ 'is-loading': isLoading }">
      <!-- Loading overlay -->
      <div v-if="isLoading" class="loading-overlay">
        <div class="loading-spinner-large"></div>
        <p class="loading-text">Loading data...</p>
      </div>

      <div class="main-data-section">
        <div class="stats-summary">
          <div class="stat-card total">
            <div class="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
              </svg>
            </div>
            <div class="stat-data">
              <h3>Total Stitch</h3>
              <div class="stat-value">{{ totalStitch }}</div>
            </div>
          </div>

          <div class="stat-card good">
            <div class="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <div class="stat-data">
              <h3>Good Stitch</h3>
              <div class="stat-value">{{ goodStitch }}</div>
            </div>
          </div>

          <div class="stat-card bad">
            <div class="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
            </div>
            <div class="stat-data">
              <h3>Bad Stitch</h3>
              <div class="stat-value">{{ badStitch }}</div>
            </div>
          </div>

          <div class="stat-card rate">
            <div class="stat-icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M20.2 7.8l-7.7 7.7-4-4-5.7 5.7"></path>
                <path d="M15 7h6v6"></path>
              </svg>
            </div>
            <div class="stat-data">
              <h3>Good Rate</h3>
              <div class="stat-value">{{ goodRate }}%</div>
            </div>
          </div>
        </div>

        <div class="charts-section">
          <div class="chart-card trend-chart">
            <h2>Stitch Trend</h2>
            <div class="chart-area">
              <canvas v-if="mounted" ref="lineChart"></canvas>
              <div v-if="!isLoading && rawData.length === 0" class="no-data-message">
                No data available for the selected date range
              </div>
            </div>
          </div>

          <div class="chart-card distribution-chart">
            <h2>Stitch Distribution</h2>
            <div class="chart-area pie-chart-container">
              <canvas v-if="mounted" ref="pieChart"></canvas>
              <div v-if="!isLoading && goodStitch === 0 && badStitch === 0" class="no-data-message">
                No data available for the selected date range
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

:root {
  --primary-color: #3b82f6;
  --good-color: #4ade80;
  --bad-color: #f87171;
  --total-color: #a78bfa;
  --rate-color: #60a5fa;
  --background-color: #f9fafb;
  --card-bg: #ffffff;
  --text-primary: #111827;
  --text-secondary: #6b7280;
  --border-color: #e5e7eb;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  --shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;

  /* Stitch Detection Theme Specific Colors */
  --stitch-theme-primary: #6366f1;
  --stitch-theme-secondary: #818cf8;
  --stitch-theme-accent: #4f46e5;
  --stitch-theme-light: #c7d2fe;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', sans-serif;
  background-color: var(--background-color);
  color: var(--text-primary);
}

.dashboard {
  max-width: 100vw;
  margin: 0 auto;
  padding: 1.5rem;
}

.header-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.page-title-container {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stitch-detection-theme h1 {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--stitch-theme-primary);
  margin: 0;
}

.nav-buttons {
  display: flex;
  gap: 0.75rem;
}

.btn-home {
  background-color: white;
  color: var(--stitch-theme-primary);
  border: 1px solid var(--stitch-theme-light);
  box-shadow: var(--shadow-sm);
}

.btn-home:hover {
  background-color: var(--stitch-theme-light);
  color: var(--stitch-theme-accent);
}

.btn-home svg {
  width: 1rem;
  height: 1rem;
  margin-right: 0.375rem;
}

.dashboard-header {
  display: flex;
  flex-direction: column;
  margin-bottom: 0.3rem;
}

.date-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--card-bg);
  padding: 1rem;
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  margin-bottom: 0.5rem;
}

.date-control-section {
  display: flex;
  align-items: center;
  gap: 1.5rem;
}

.date-picker-group {
  display: flex;
  gap: 1rem;
}

.date-picker {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.date-picker label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-secondary);
}

.date-picker input {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-family: 'Inter', sans-serif;
  font-size: 0.875rem;
}

.date-picker input:disabled {
  background-color: #f3f4f6;
  cursor: not-allowed;
}

.stitch-detection-theme .date-picker input:focus {
  outline: 2px solid var(--stitch-theme-light);
  border-color: var(--stitch-theme-secondary);
}

.date-quick-select {
  display: flex;
  gap: 0.5rem;
}

.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 1rem;
  border-radius: var(--radius-md);
  font-weight: 500;
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
  border: none;
  gap: 0.5rem;
}

.btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.btn-quick {
  background-color: #f3f4f6;
  color: var(--text-secondary);
  position: relative;
}

.stitch-detection-theme .btn-quick:hover:not(:disabled) {
  background-color: var(--stitch-theme-light);
  color: var(--stitch-theme-primary);
}

.btn-loading {
  position: relative;
  padding-left: 2rem;
}

.btn-export {
  background-color: var(--stitch-theme-primary);
  color: white;
  white-space: nowrap;
}

.btn-export:hover:not(:disabled) {
  background-color: var(--stitch-theme-accent);
}

.btn-export:disabled {
  background-color: #a5b4fc;
}

.btn-export svg {
  width: 1rem;
  height: 1rem;
}

.dashboard-content {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.5rem;
  position: relative;
}

.is-loading {
  min-height: 400px;
}

.loading-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.7);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  z-index: 10;
  border-radius: var(--radius-lg);
}

.loading-spinner {
  display: inline-block;
  width: 1rem;
  height: 1rem;
  border: 2px solid rgba(99, 102, 241, 0.3);
  border-radius: 50%;
  border-top-color: var(--stitch-theme-primary);
  animation: spin 1s linear infinite;
  margin-right: 0.5rem;
}

.loading-spinner-large {
  width: 3rem;
  height: 3rem;
  border: 3px solid rgba(99, 102, 241, 0.3);
  border-radius: 50%;
  border-top-color: var(--stitch-theme-primary);
  animation: spin 1s linear infinite;
}

.loading-text {
  margin-top: 1rem;
  font-size: 1rem;
  color: var(--stitch-theme-primary);
  font-weight: 500;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.main-data-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.stats-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.stat-card {
  background-color: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  box-shadow: var(--shadow-sm);
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.stitch-detection-theme .stat-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.stat-icon {
  width: 3rem;
  height: 3rem;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg {
  width: 1.5rem;
  height: 1.5rem;
}

.stat-card.total .stat-icon {
  background-color: rgba(167, 139, 250, 0.1);
  color: var(--total-color);
}

.stat-card.good .stat-icon {
  background-color: rgba(74, 222, 128, 0.1);
  color: var(--good-color);
}

.stat-card.bad .stat-icon {
  background-color: rgba(248, 113, 113, 0.1);
  color: var(--bad-color);
}

.stat-card.rate .stat-icon {
  background-color: rgba(96, 165, 250, 0.1);
  color: var(--rate-color);
}

.stat-data {
  flex-grow: 1;
}

.stat-data h3 {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  margin-bottom: 0.25rem;
}

.stat-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.charts-section {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}

.chart-card {
  background-color: var(--card-bg);
  border-radius: var(--radius-lg);
  padding: 1rem;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
  position: relative;
}

.chart-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: var(--text-primary);
}

.stitch-detection-theme .chart-card h2 {
  color: var(--stitch-theme-primary);
  border-bottom: 1px solid var(--stitch-theme-light);
  padding-bottom: 0.75rem;
}

.chart-area {
  height: 320px;
  position: relative;
}

.pie-chart-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.no-data-message {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  font-size: 0.875rem;
  text-align: center;
  padding: 1rem;
}

/* Responsive adjustments */
@media (max-width: 1024px) {
  .charts-section {
    grid-template-columns: 1fr;
  }

  .chart-area {
    height: 300px;
  }
}

@media (max-width: 768px) {
  .date-controls {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .date-control-section {
    flex-direction: column;
    align-items: flex-start;
    width: 100%;
  }

  .date-picker-group {
    width: 100%;
  }

  .date-picker {
    flex: 1;
  }

  .date-quick-select {
    width: 100%;
    justify-content: space-between;
  }

  .stats-summary {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 640px) {
  .dashboard {
    padding: 1rem;
  }

  .header-top {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .nav-buttons {
    width: 100%;
  }

  .btn-home {
    width: 100%;
  }

  .stats-summary {
    grid-template-columns: 1fr;
  }

  .charts-section {
    grid-template-columns: 1fr;
  }

  .chart-area {
    height: 250px;
  }
}
</style>
