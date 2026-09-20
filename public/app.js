// ---------------------- تنظیمات ----------------------
const MAX_POINTS = 1250; // پنجره‌ی نمایش نمودار (مثلاً 5 ثانیه در 250Hz)

// ---------------------- عناصر DOM ----------------------
const connectionStatusEl = document.getElementById('connectionStatus');
const leadStatusEl = document.getElementById('leadStatus');
const deviceIdEl = document.getElementById('deviceId');
const sampleRateEl = document.getElementById('sampleRate');
const lastUpdateEl = document.getElementById('lastUpdate');
const totalSamplesEl = document.getElementById('totalSamples');

// ---------------------- تنظیمات نمودار ----------------------
const ctx = document.getElementById('ecgChart').getContext('2d');

const chartData = {
  labels: [],
  datasets: [{
    label: 'ECG',
    data: [],
    borderColor: '#4ade80',
    borderWidth: 1.5,
    pointRadius: 0,
    tension: 0.15,
    fill: false
  }]
};

const ecgChart = new Chart(ctx, {
  type: 'line',
  data: chartData,
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    scales: {
      x: {
        display: false
      },
      y: {
        min: 0,
        max: 1024, // رنج ADC ده‌بیتی ESP8266
        grid: { color: '#1f2937' },
        ticks: { color: '#94a3b8' }
      }
    },
    plugins: {
      legend: { display: false }
    }
  }
});

let totalSamples = 0;
let pointCounter = 0;

// ---------------------- اتصال WebSocket ----------------------
function connectWebSocket() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws`;
  const socket = new WebSocket(wsUrl);

  socket.onopen = () => {
    connectionStatusEl.textContent = 'متصل به سرور';
    connectionStatusEl.className = 'badge badge-on';
  };

  socket.onclose = () => {
    connectionStatusEl.textContent = 'قطع شد، در حال تلاش مجدد...';
    connectionStatusEl.className = 'badge badge-off';
    setTimeout(connectWebSocket, 2000); // تلاش مجدد
  };

  socket.onerror = () => {
    socket.close();
  };

  socket.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.type === 'ecg_batch') {
        handleBatch(msg);
      }
    } catch (err) {
      console.error('خطا در پردازش پیام:', err);
    }
  };
}

// ---------------------- پردازش دسته‌ی دریافتی ----------------------
function handleBatch(msg) {
  const { device_id, sample_rate, lead_off, samples } = msg;

  // به‌روزرسانی وضعیت‌ها
  deviceIdEl.textContent = `دستگاه: ${device_id || '-'}`;
  sampleRateEl.textContent = sample_rate ? `${sample_rate} Hz` : '-';
  lastUpdateEl.textContent = new Date().toLocaleTimeString('fa-IR');

  if (lead_off) {
    leadStatusEl.textContent = 'وضعیت الکترود: جدا شده!';
    leadStatusEl.className = 'badge badge-off';
  } else {
    leadStatusEl.textContent = 'وضعیت الکترود: متصل';
    leadStatusEl.className = 'badge badge-on';
  }

  // اضافه کردن نمونه‌ها به نمودار (اگر لید جدا شده باشه رسم نمی‌کنیم)
  if (!lead_off) {
    samples.forEach((value) => {
      if (value < 0) return; // مقادیر نامعتبر (-1) رو نادیده بگیر

      chartData.labels.push(pointCounter++);
      chartData.datasets[0].data.push(value);

      // نگه داشتن فقط آخرین MAX_POINTS نمونه (اسکرول)
      if (chartData.datasets[0].data.length > MAX_POINTS) {
        chartData.labels.shift();
        chartData.datasets[0].data.shift();
      }
    });

    totalSamples += samples.length;
    totalSamplesEl.textContent = totalSamples.toLocaleString('fa-IR');

    ecgChart.update('none'); // آپدیت بدون انیمیشن برای عملکرد بهتر
  }
}

// ---------------------- شروع ----------------------
connectWebSocket();
