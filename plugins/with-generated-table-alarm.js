const fs = require('fs');
const path = require('path');

module.exports = function withGeneratedTableAlarm(config) {
  const soundDirectory = path.resolve(__dirname, '..', 'assets', 'sounds');
  const soundPath = path.join(soundDirectory, 'table_alarm.wav');
  const previousSoundPath = path.join(soundDirectory, 'table-alarm.wav');
  if (fs.existsSync(previousSoundPath)) fs.unlinkSync(previousSoundPath);
  fs.mkdirSync(soundDirectory, { recursive: true });

  const sampleRate = 22050;
  const durationSeconds = 20;
  const sampleCount = sampleRate * durationSeconds;
  const dataLength = sampleCount * 2;
  const wav = Buffer.alloc(44 + dataLength);

  wav.write('RIFF', 0);
  wav.writeUInt32LE(36 + dataLength, 4);
  wav.write('WAVE', 8);
  wav.write('fmt ', 12);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * 2, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36);
  wav.writeUInt32LE(dataLength, 40);

  for (let index = 0; index < sampleCount; index += 1) {
    const time = index / sampleRate;
    const cyclePosition = time % 2.2;
    let frequency = 0;
    let beepPosition = 0;
    let beepLength = 0;

    if (cyclePosition < 0.34) {
      frequency = 880;
      beepPosition = cyclePosition;
      beepLength = 0.34;
    } else if (cyclePosition >= 0.5 && cyclePosition < 0.84) {
      frequency = 660;
      beepPosition = cyclePosition - 0.5;
      beepLength = 0.34;
    } else if (cyclePosition >= 1 && cyclePosition < 1.34) {
      frequency = 880;
      beepPosition = cyclePosition - 1;
      beepLength = 0.34;
    }

    const fade = frequency
      ? Math.min(1, beepPosition / 0.015, (beepLength - beepPosition) / 0.04)
      : 0;
    const sample = Math.round(15000 * fade * Math.sin(2 * Math.PI * frequency * time));
    wav.writeInt16LE(sample, 44 + index * 2);
  }

  fs.writeFileSync(soundPath, wav);
  return config;
};