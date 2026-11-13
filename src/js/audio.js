// Akustisches Vario: Piepen bei Steigen (schneller und höher je stärker), Brummton bei starkem Sinken.
export class VarioSound {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.clock = 0;
  }

  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.osc = this.ctx.createOscillator();
      this.osc.type = 'triangle';
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    } catch { this.ctx = null; }
  }

  update(vz, realDt, active) {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    let level = 0, freq = 600;
    if (this.enabled && active) {
      if (vz > 0.15) {
        const period = Math.max(0.12, 0.55 - 0.08 * vz);
        this.clock = (this.clock + realDt) % period;
        freq = 560 + 130 * Math.min(vz, 5);
        level = this.clock < period * 0.55 ? 0.12 : 0;
      } else if (vz < -2.6) {
        freq = Math.max(140, 260 + 25 * vz);
        level = 0.05;
      }
    }
    this.osc.frequency.setTargetAtTime(freq, now, 0.02);
    this.gain.gain.setTargetAtTime(level, now, 0.012);
  }
}
