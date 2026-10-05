'use strict';

const STANDARD_FLOW = Object.freeze(['qualifying', 'race']);
const SPRINT_FLOW = Object.freeze(['sprintQualifying', 'sprint', 'qualifying', 'race']);
const SCORING_PHASES = new Set(['sprintQualifying', 'sprint', 'qualifying', 'race']);
const PRACTICE_PHASES = new Set(['practice', 'unknown']);

const LABELS = Object.freeze({
  sprintQualifying: 'Sprint Qualifying',
  sprint: 'Sprint',
  qualifying: 'Qualifying',
  race: 'Race'
});

/**
 * Session/Weekend state machine.
 *
 * Important design rule: telemetry is allowed to advance the state machine,
 * but a later session can never mutate an already locked session.
 */
class WeekendManager {
  constructor(options = {}) {
    this.onChange = typeof options.onChange === 'function' ? options.onChange : () => {};
    this.onLock = typeof options.onLock === 'function' ? options.onLock : () => {};
    this.onWeekendComplete = typeof options.onWeekendComplete === 'function' ? options.onWeekendComplete : () => {};
    this.reset(options.initial || {});
  }

  reset(initial = {}) {
    this.weekendType = initial.weekendType === 'sprint' ? 'sprint' : 'standard';
    this.flow = this.weekendType === 'sprint' ? [...SPRINT_FLOW] : [...STANDARD_FLOW];
    this.currentPhase = this.flow.includes(initial.currentPhase) ? initial.currentPhase : this.flow[0];
    this.completed = { ...(initial.completedPhases || {}) };
    this.locked = { ...(initial.lockedPhases || {}) };
    this.sessionUID = initial.sessionUID ?? null;
    this.lastDetected = initial.lastDetected ?? null;
    this.waitingForNext = Boolean(initial.waitingForNext);
    this.weekendComplete = Boolean(initial.weekendComplete);
    this.round = Number(initial.round || 0);
  }

  snapshot() {
    return {
      weekendType: this.weekendType,
      flow: [...this.flow],
      currentPhase: this.currentPhase,
      completedPhases: { ...this.completed },
      lockedPhases: { ...this.locked },
      sessionUID: this.sessionUID,
      lastDetected: this.lastDetected,
      waitingForNext: this.waitingForNext,
      weekendComplete: this.weekendComplete,
      round: this.round
    };
  }

  setWeekendType(type, options = {}) {
    const next = type === 'sprint' ? 'sprint' : 'standard';
    if (!options.force && Object.keys(this.completed).length) return false;
    this.weekendType = next;
    this.flow = next === 'sprint' ? [...SPRINT_FLOW] : [...STANDARD_FLOW];
    this.currentPhase = this.flow[0];
    this.completed = {};
    this.locked = {};
    this.waitingForNext = false;
    this.weekendComplete = false;
    this._changed('weekend-type');
    return true;
  }

  /**
   * Convert F1 UDP session types into the phases we actually score.
   * Practice is intentionally ignored.
   * A Sprint weekend uses the first Race-type session as Sprint and the later
   * Race-type session as the main Race.
   */
  classifyDetected(kind) {
    if (PRACTICE_PHASES.has(kind)) return 'practice';
    if (kind === 'sprintQualifying') return 'sprintQualifying';
    if (kind === 'qualifying') return 'qualifying';
    if (kind === 'race') {
      if (this.weekendType === 'sprint') {
        if (!this.completed.sprint && this.currentPhase === 'sprint') return 'sprint';
        if (!this.completed.race && (this.currentPhase === 'race' || this.completed.qualifying)) return 'race';
        if (!this.completed.sprint) return 'sprint';
        return 'race';
      }
      return 'race';
    }
    return null;
  }

  /**
   * Called for every Session packet. This is the only place that advances the
   * weekend phase. Podium/replay packets do not call this with a new scoring
   * phase, so they cannot erase a locked result.
   */
  detect(kind, sessionUID, meta = {}) {
    const detected = this.classifyDetected(kind);
    if (detected === 'practice') {
      this.lastDetected = 'practice';
      return { action: 'ignore', phase: this.currentPhase, reason: 'practice' };
    }
    if (!detected || !SCORING_PHASES.has(detected)) {
      return { action: 'ignore', phase: this.currentPhase, reason: 'unscored-session' };
    }

    // Seeing a sprint-qualifying session proves this is a Sprint weekend.
    if (detected === 'sprintQualifying' && this.weekendType !== 'sprint' && !Object.keys(this.completed).length) {
      this.setWeekendType('sprint', { force: true });
    }

    const previousPhase = this.currentPhase;
    const uidChanged = this.sessionUID !== null && sessionUID != null && String(this.sessionUID) !== String(sessionUID);

    // If telemetry jumps directly to a later phase, fill only the state-machine
    // transition. We never fabricate scores for the skipped phase.
    const targetIndex = this.flow.indexOf(detected);
    const currentIndex = this.flow.indexOf(this.currentPhase);

    if (this.locked[detected]) {
      this.sessionUID = sessionUID;
      this.waitingForNext = false;
      this.lastDetected = detected;
      return { action: 'locked', phase: detected, previousPhase, uidChanged };
    }

    if (targetIndex >= 0 && targetIndex >= currentIndex) {
      if (detected !== this.currentPhase) {
        this.currentPhase = detected;
        this.waitingForNext = false;
        this._changed('session-advanced', { previousPhase, phase: detected });
      }
    }

    this.sessionUID = sessionUID;
    this.lastDetected = detected;
    return {
      action: detected === previousPhase ? 'same-session' : 'advanced',
      phase: this.currentPhase,
      previousPhase,
      uidChanged,
      sessionName: meta.name || LABELS[this.currentPhase]
    };
  }

  /**
   * Lock a completed scoring phase. The supplied rows are treated as immutable
   * snapshots; they are never recalculated from later live telemetry.
   */
  lockPhase(phase, rows, meta = {}) {
    if (!SCORING_PHASES.has(phase)) return { locked: false, phase };
    if (this.locked[phase]) return { locked: true, alreadyLocked: true, phase };

    const snapshot = Array.isArray(rows) ? rows.map(r => ({ ...r })) : [];
    this.locked[phase] = {
      lockedAt: new Date().toISOString(),
      sessionUID: meta.sessionUID ?? this.sessionUID,
      rowCount: snapshot.length
    };
    this.completed[phase] = true;
    this.waitingForNext = true;

    this.onLock({ phase, rows: snapshot, meta });
    this._changed('phase-locked', { phase });

    if (phase === 'race') {
      this.weekendComplete = true;
      this.onWeekendComplete(this.snapshot());
      this._changed('weekend-complete');
    }

    return { locked: true, alreadyLocked: false, phase, rows: snapshot };
  }

  nextPhase() {
    const i = this.flow.indexOf(this.currentPhase);
    return i >= 0 && i + 1 < this.flow.length ? this.flow[i + 1] : null;
  }

  isComplete(phase = this.currentPhase) {
    return Boolean(this.completed[phase]);
  }

  isLocked(phase = this.currentPhase) {
    return Boolean(this.locked[phase]);
  }

  _changed(reason, extra = {}) {
    this.onChange({ reason, ...extra, state: this.snapshot() });
  }
}

module.exports = {
  WeekendManager,
  STANDARD_FLOW,
  SPRINT_FLOW,
  LABELS
};
