// ─── Mobile controls ────────────────────────────────────────────────────
class MobileControls {
  constructor(player) {
    this.player = player;
    this.active = false;
    this._joystickActive = false;
    this._joystickStartX = 0;
    this._joystickStartY = 0;
    this._cameraTouch = null;
    this._prevCamX = 0;
    this._prevCamY = 0;

    this.detect();
  }

  detect() {
    const isMobile = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent)
                  || ('ontouchstart' in window && window.innerWidth < 900);
    if (isMobile) this.enable();
  }

  enable() {
    this.active = true;
    const mc = document.getElementById('mobile-controls');
    if (mc) mc.style.display = 'block';
    this._bindJoystick();
    this._bindCameraTouch();
    this._bindButtons();
  }

  _bindJoystick() {
    const zone = document.getElementById('joystick-zone');
    const knob = document.getElementById('joystick-knob');
    const base = document.getElementById('joystick-base');
    if (!zone || !knob) return;
    const R = 36; // max knob radius

    zone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      const rect = base.getBoundingClientRect();
      this._joystickActive = true;
      this._joystickStartX = rect.left + rect.width/2;
      this._joystickStartY = rect.top + rect.height/2;
    }, { passive: false });

    zone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!this._joystickActive) return;
      const t = e.changedTouches[0];
      let dx = t.clientX - this._joystickStartX;
      let dy = t.clientY - this._joystickStartY;
      const dist = Math.sqrt(dx*dx+dy*dy);
      if (dist > R) { const s=R/dist; dx*=s; dy*=s; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      this.player.joystick.x = dx/R;
      this.player.joystick.y = -dy/R;
    }, { passive: false });

    const endJoy = (e) => {
      this._joystickActive = false;
      knob.style.transform = '';
      this.player.joystick.x = 0;
      this.player.joystick.y = 0;
    };
    zone.addEventListener('touchend', endJoy);
    zone.addEventListener('touchcancel', endJoy);
  }

  _bindCameraTouch() {
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        // Ignore if touch is on joystick zone or buttons
        const target = document.elementFromPoint(t.clientX, t.clientY);
        if (target && (target.closest('#joystick-zone') || target.closest('#mobile-action-buttons'))) continue;
        if (!this._cameraTouch) {
          this._cameraTouch = t.identifier;
          this._prevCamX = t.clientX;
          this._prevCamY = t.clientY;
        }
      }
    }, { passive: true });

    canvas.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._cameraTouch) {
          const dx = t.clientX - this._prevCamX;
          const dy = t.clientY - this._prevCamY;
          this._prevCamX = t.clientX;
          this._prevCamY = t.clientY;
          this.player.ry -= dx * 0.004;
          this.player.rx -= dy * 0.004;
          this.player.rx = MathUtils.clamp(this.player.rx, -Math.PI/2+0.01, Math.PI/2-0.01);
        }
      }
    }, { passive: true });

    const endCam = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._cameraTouch) this._cameraTouch = null;
      }
    };
    canvas.addEventListener('touchend', endCam, { passive: true });
    canvas.addEventListener('touchcancel', endCam, { passive: true });
  }

  _bindButtons() {
    const btnJump  = document.getElementById('btn-jump');
    const btnBreak = document.getElementById('btn-break');
    const btnPlace = document.getElementById('btn-place');
    const btnInv   = document.getElementById('btn-inv');

    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); this.player.jumpPressed = true; }, { passive: false });
      btnJump.addEventListener('touchend',   () => { this.player.jumpPressed = false; });
    }
    if (btnBreak) {
      btnBreak.addEventListener('touchstart', (e) => { e.preventDefault(); this.player.startBreaking(); }, { passive: false });
      btnBreak.addEventListener('touchend',   () => this.player.stopBreaking());
    }
    if (btnPlace) {
      btnPlace.addEventListener('touchstart', (e) => { e.preventDefault(); this.player.startPlacing(); }, { passive: false });
      btnPlace.addEventListener('touchend',   () => this.player.stopPlacing());
    }
    if (btnInv) {
      btnInv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.ui) window.ui.toggleInventory();
      }, { passive: false });
    }
  }
}
