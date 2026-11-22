/**
 * Ambiance sonore de la visite « mode jeu » (étape 8b), entièrement SYNTHÉTISÉE par le
 * navigateur (Web Audio) : aucun fichier son, donc aucun droit à céder. Vent et vagues
 * (bruit filtré), oiseaux (gazouillis de fréquences glissantes), grillons la nuit, pas sur le
 * sentier, coups de pagaie. Démarre au premier geste (règle des navigateurs).
 */

type Ambiance = "aube" | "jour" | "crepuscule" | "nuit";

export class TourAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private wind: GainNode | null = null;
  private waves: GainNode | null = null;
  private waveFilter: BiquadFilterNode | null = null;
  private noise: AudioBuffer | null = null;
  private nextBird = 0;
  private nextCricket = 0;
  private muted = false;
  ambiance: Ambiance = "jour";

  start() {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.master.connect(ctx.destination);

    // Bruit blanc commun (2 s, en boucle).
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buffer;

    // Vent : bruit passe-bas qui ondule lentement.
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.06;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = "lowpass";
    windFilter.frequency.value = 420;
    const windLfo = ctx.createOscillator();
    const windDepth = ctx.createGain();
    windLfo.frequency.value = 0.12;
    windDepth.gain.value = 240;
    windLfo.connect(windDepth).connect(windFilter.frequency);
    windLfo.start();
    this.loop(windFilter);
    windFilter.connect(this.wind).connect(this.master);

    // Vagues : bruit passe-bande, volume réglé par la proximité de l'eau.
    this.waves = ctx.createGain();
    this.waves.gain.value = 0;
    this.waveFilter = ctx.createBiquadFilter();
    this.waveFilter.type = "bandpass";
    this.waveFilter.frequency.value = 700;
    this.waveFilter.Q.value = 0.6;
    const swell = ctx.createOscillator();
    const swellDepth = ctx.createGain();
    swell.frequency.value = 0.16;
    swellDepth.gain.value = 0.5;
    const swellGain = ctx.createGain();
    swellGain.gain.value = 0.5;
    swell.connect(swellDepth).connect(swellGain.gain);
    swell.start();
    this.loop(this.waveFilter);
    this.waveFilter.connect(swellGain).connect(this.waves).connect(this.master);
  }

  private loop(destination: AudioNode) {
    if (!this.ctx || !this.noise) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    src.connect(destination);
    src.start();
  }

  setMuted(value: boolean) {
    this.muted = value;
    if (this.master && this.ctx)
      this.master.gain.setTargetAtTime(value ? 0 : 0.8, this.ctx.currentTime, 0.1);
  }

  /** Proximité de l'eau (0 à 1) : volume des vagues. */
  setWater(level: number) {
    if (this.waves && this.ctx)
      this.waves.gain.setTargetAtTime(0.22 * level, this.ctx.currentTime, 0.4);
  }

  /** Un pas sur le sentier (bruit bref et sourd). */
  step(sprint: boolean) {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900 + Math.random() * 500;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(sprint ? 0.26 : 0.18, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.14);
  }

  /** Coup de pagaie (clapotis). */
  splash() {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.noise || this.muted) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1400;
    const gain = ctx.createGain();
    const t = ctx.currentTime;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.25, t + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(filter).connect(gain).connect(this.master);
    src.start(t, Math.random());
    src.stop(t + 0.5);
  }

  /** À appeler à chaque image : oiseaux le jour, grillons la nuit. */
  tick(now: number) {
    const ctx = this.ctx;
    if (!ctx || !this.master || this.muted) return;
    const night = this.ambiance === "nuit" || this.ambiance === "crepuscule";
    if (!night && now > this.nextBird) {
      this.nextBird = now + 1800 + Math.random() * 4500;
      this.bird();
    }
    if (night && now > this.nextCricket) {
      this.nextCricket = now + 350 + Math.random() * 500;
      this.cricket();
    }
  }

  private bird() {
    const ctx = this.ctx!;
    const notes = 2 + Math.floor(Math.random() * 4);
    const base = 2200 + Math.random() * 1800;
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    pan.connect(this.master!);
    for (let i = 0; i < notes; i++) {
      const t = ctx.currentTime + i * (0.09 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.3), t);
      osc.frequency.exponentialRampToValueAtTime(base * (1.2 + Math.random() * 0.4), t + 0.07);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.045, t + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      osc.connect(gain).connect(pan);
      osc.start(t);
      osc.stop(t + 0.1);
    }
  }

  private cricket() {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = 4300 + Math.random() * 300;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    for (let i = 0; i < 3; i++) {
      gain.gain.setValueAtTime(0.012, t + i * 0.05);
      gain.gain.setValueAtTime(0, t + i * 0.05 + 0.025);
    }
    osc.connect(gain).connect(this.master!);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
  }
}
