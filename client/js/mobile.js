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
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._touchStartTime = 0;
    this._breakHoldTimer = null;
    this._breakingFromTouch = false;
    this._holdDelayMs = 220;
    this._moveDeadzonePx = 12;

    this.detect();
  }

  detect() {
    const isTouchUA = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent);
    const coarsePointer = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    const isSmallScreen = window.innerWidth <= 1024;
    const isMobile = isTouchUA || coarsePointer || (('ontouchstart' in window) && isSmallScreen);
    if (isMobile) this.enable();

    // Fallback for devices where detection is delayed or inconsistent.
    window.addEventListener('touchstart', () => {
      if (!this.active) this.enable();
    }, { passive: true, once: true });

    window.addEventListener('resize', () => {
      const shouldEnable = /Android|iPhone|iPad|iPod|Touch/i.test(navigator.userAgent)
        || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      if (shouldEnable && !this.active) this.enable();
    });
  }

  enable() {
    if (this.active) return;
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
    if (!canvas) return;

    const clearHoldTimer = () => {
      if (this._breakHoldTimer) {
        clearTimeout(this._breakHoldTimer);
        this._breakHoldTimer = null;
      }
    };

    canvas.addEventListener('touchstart', (e) => {
      for (const t of e.changedTouches) {
        // Ignore if touch is on joystick zone or buttons
        const target = document.elementFromPoint(t.clientX, t.clientY);
        if (target && (target.closest('#joystick-zone') || target.closest('#mobile-action-buttons') || target.closest('#mobile-top-buttons'))) continue;
        if (!this._cameraTouch) {
          this._cameraTouch = t.identifier;
          this._prevCamX = t.clientX;
          this._prevCamY = t.clientY;
          this._touchStartX = t.clientX;
          this._touchStartY = t.clientY;
          this._touchStartTime = performance.now();
          this._breakingFromTouch = false;

          clearHoldTimer();
          this._breakHoldTimer = setTimeout(() => {
            if (this._cameraTouch === t.identifier && !this._breakingFromTouch && window.ui && !window.ui.isBlocking()) {
              this.player.startBreaking();
              this._breakingFromTouch = true;
            }
          }, this._holdDelayMs);
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

          const moveFromStart = Math.hypot(t.clientX - this._touchStartX, t.clientY - this._touchStartY);
          if (moveFromStart > this._moveDeadzonePx && !this._breakingFromTouch) {
            clearHoldTimer();
          }

          this.player.ry -= dx * 0.004;
          this.player.rx -= dy * 0.004;
          this.player.rx = MathUtils.clamp(this.player.rx, -Math.PI/2+0.01, Math.PI/2-0.01);
        }
      }
    }, { passive: true });

    const endCam = (e) => {
      for (const t of e.changedTouches) {
        if (t.identifier === this._cameraTouch) {
          clearHoldTimer();

          const dt = performance.now() - this._touchStartTime;
          const moved = Math.hypot(t.clientX - this._touchStartX, t.clientY - this._touchStartY) > this._moveDeadzonePx;

          if (this._breakingFromTouch) {
            this.player.stopBreaking();
          } else if (!moved && dt < 300) {
            // Tap-to-use: place block / eat / use object.
            if (window.mobilePrimaryAction) window.mobilePrimaryAction();
          }

          this._breakingFromTouch = false;
          this._cameraTouch = null;
        }
      }
    };
    canvas.addEventListener('touchend', endCam, { passive: true });
    canvas.addEventListener('touchcancel', endCam, { passive: true });
  }

  _bindButtons() {
    const btnJump  = document.getElementById('btn-jump');
    const btnInv   = document.getElementById('btn-inv');
    const btnChat  = document.getElementById('btn-chat-top-mobile');
    const btnPause = document.getElementById('btn-pause-top-mobile');
    const btnFull  = document.getElementById('btn-fullscreen-mobile');
    const btnDrop  = document.getElementById('btn-drop-mobile');
    const btnSneak = document.getElementById('btn-sneak-mobile');
    const btnUse   = document.getElementById('btn-use-mobile');

    if (btnJump) {
      btnJump.addEventListener('touchstart', (e) => { e.preventDefault(); this.player.jumpPressed = true; }, { passive: false });
      btnJump.addEventListener('touchend',   () => { this.player.jumpPressed = false; });
    }
    if (btnInv) {
      btnInv.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.ui) window.ui.toggleInventory();
      }, { passive: false });
    }

    if (btnChat) {
      btnChat.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.ui) window.ui.openChat();
      }, { passive: false });
    }

    if (btnPause) {
      btnPause.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.ui) window.ui.togglePause();
      }, { passive: false });
    }

    if (btnFull) {
      const toggleFullscreen = async () => {
        const doc = document;
        const el = document.documentElement;
        const isFull = !!(doc.fullscreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement);
        try {
          if (!isFull) {
            if (el.requestFullscreen) await el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
          } else {
            if (doc.exitFullscreen) await doc.exitFullscreen();
            else if (doc.webkitExitFullscreen) doc.webkitExitFullscreen();
            else if (doc.msExitFullscreen) doc.msExitFullscreen();
          }
        } catch (err) {
          console.warn('[Mobile] Fullscreen toggle failed:', err?.message || err);
        }
      };

      btnFull.addEventListener('touchstart', (e) => {
        e.preventDefault();
        toggleFullscreen();
      }, { passive: false });
    }

    if (btnDrop) {
      let dropTouchId = null;
      btnDrop.addEventListener('touchstart', (e) => {
        e.preventDefault();
        dropTouchId = e.changedTouches[0]?.identifier;
      }, { passive: false });
      btnDrop.addEventListener('touchend', (e) => {
        e.preventDefault();
        if (dropTouchId !== null && window.dropSelectedItem) {
          window.dropSelectedItem();
        }
        dropTouchId = null;
      }, { passive: false });
      btnDrop.addEventListener('touchcancel', () => {
        dropTouchId = null;
      });
    }

    if (btnUse) {
      btnUse.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (window.mobilePrimaryAction) window.mobilePrimaryAction();
      }, { passive: false });
    }

    if (btnSneak) {
      btnSneak.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.player.keys['ShiftLeft'] = true;
      }, { passive: false });
      const stopSneak = () => {
        this.player.keys['ShiftLeft'] = false;
      };
      btnSneak.addEventListener('touchend', stopSneak);
      btnSneak.addEventListener('touchcancel', stopSneak);
    }
  }
}
