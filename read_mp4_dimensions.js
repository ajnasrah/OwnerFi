// Read MP4 dimensions from file header
const fs = require('fs');

function readMP4Dimensions(filePath) {
  const buffer = fs.readFileSync(filePath);

  // Look for 'tkhd' (track header) atom which contains dimensions
  let tkhdIndex = buffer.indexOf('tkhd');

  if (tkhdIndex === -1) {
    console.log('Could not find tkhd atom');
    return null;
  }

  // Width and height are stored as 32-bit fixed-point values
  // at offset 76 and 80 from the start of tkhd
  const widthOffset = tkhdIndex + 76;
  const heightOffset = tkhdIndex + 80;

  if (widthOffset + 4 <= buffer.length && heightOffset + 4 <= buffer.length) {
    const width = buffer.readUInt32BE(widthOffset) / 65536; // Convert from fixed-point
    const height = buffer.readUInt32BE(heightOffset) / 65536;

    return { width, height };
  }

  return null;
}

try {
  const dimensions = readMP4Dimensions('test_video.mp4');

  if (dimensions) {
    console.log('\n🎬 VIDEO DIMENSIONS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`   Width:  ${dimensions.width}px`);
    console.log(`   Height: ${dimensions.height}px`);
    console.log(`   Ratio:  ${(dimensions.width / dimensions.height).toFixed(2)}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (dimensions.width === 1080 && dimensions.height === 1920) {
      console.log('✅ SUCCESS! Video is in mobile format (1080x1920)');
      console.log('   This confirms the API respects the dimension parameter.\n');
    } else if (dimensions.width === 1920 && dimensions.height === 1080) {
      console.log('❌ WRONG! Video is in desktop format (1920x1080)');
      console.log('   The API is NOT respecting the dimension parameter.\n');
    } else {
      console.log(`ℹ️  Video has custom dimensions: ${dimensions.width}x${dimensions.height}\n`);
    }
  } else {
    console.log('❌ Could not read video dimensions');
  }
} catch (error) {
  console.error('Error:', error.message);
}
