const videoId = process.argv[2] || '16a81a7572244f9a9731b10c7d7eec6c';
const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY;

if (!HEYGEN_API_KEY) {
  console.error('HEYGEN_API_KEY not set');
  process.exit(1);
}

async function checkStatus() {
  const response = await fetch(`https://api.heygen.com/v1/video_status.get?video_id=${videoId}`, {
    headers: { 'x-api-key': HEYGEN_API_KEY! }
  });

  const data = await response.json();
  console.log(JSON.stringify(data, null, 2));
}

checkStatus();
