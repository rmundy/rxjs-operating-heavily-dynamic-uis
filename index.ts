import { combineLatest, merge, NEVER, Observable, pipe, Subject, timer, UnaryFunction } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  mapTo,
  pluck,
  scan,
  shareReplay,
  startWith,
  switchMap,
  tap,
  withLatestFrom
} from 'rxjs/operators';

import { CountDownState, Counter, CounterStateKeys, PartialCountDownState } from './counter';

// EXERCISE DESCRIPTION ===================================================

/**
 * Use `CounterStateKeys` for property names.
 * Explore the counterUI API by typing `counterUI.` somewhere. ;)
 *
 * Implement all features of the counter:
 * 1. Start, pause the counter. Then restart the counter with 0 (+)
 * 2. Start it again from paused number (++)
 * 3. If Set to button is clicked set counter value to input value while counting (+++)
 * 4. Reset to initial state if reset button is clicked (+)
 * 5. If count up button is clicked count up, if count down button is clicked count down  (+)
 * 6. Change interval if input tickSpeed input changes (++)
 * 7. Change count up if input countDiff changes (++)
 * 8. Take care of rendering execution and other performance optimizations as well as refactoring (+)
 */

// ========================================================================

// == CONSTANTS ===========================================================
// Setup countDown state
const initialCounterState: CountDownState = {
  count: 0,
  isTicking: false,
  tickSpeed: 200,
  countUp: true,
  countDiff: 1
};

const multiple = 10;
// Init CountDown counterUI
const counterUI = new Counter(document.body, {
  initialSetTo: initialCounterState.count + multiple,
  initialTickSpeed: initialCounterState.tickSpeed,
  initialCountDiff: initialCounterState.countDiff
});

// = BASE OBSERVABLES  ====================================================
// == SOURCE OBSERVABLES ==================================================
// All our source observables are extracted into Counter class to hide away all the low leven bindings.
// === STATE OBSERVABLES ==================================================
const programmaticCommandSubject = new Subject<PartialCountDownState>();
const counterCommands$ = merge<CountDownState>(
  counterUI.btnStart$.pipe(mapTo({ isTicking: true })),
  counterUI.btnPause$.pipe(mapTo({ isTicking: false })),
  counterUI.btnSetTo$.pipe(map((n) => ({ count: n }))),
  counterUI.btnUp$.pipe(mapTo({ countUp: true })),
  counterUI.btnDown$.pipe(mapTo({ countUp: false })),
  counterUI.btnReset$.pipe(mapTo({ ...initialCounterState })),
  counterUI.inputTickSpeed$.pipe(map((n) => ({ tickSpeed: n }))),
  counterUI.inputCountDiff$.pipe(map((n) => ({ countDiff: n }))),
  programmaticCommandSubject.asObservable()
);

const counterState$: Observable<CountDownState> = counterCommands$.pipe(
  startWith(initialCounterState),
  scan((counterState: CountDownState, command): CountDownState => ({ ...counterState, ...command })),
  shareReplay(1)
);

// === INTERACTION OBSERVABLES ============================================
// == INTERMEDIATE OBSERVABLES ============================================
const count$ = counterState$.pipe(pluck<CountDownState, number>(CounterStateKeys.count));
const isTicking$ = counterState$.pipe(queryChange<CountDownState, boolean>(CounterStateKeys.isTicking));
const tickSpeed$ = counterState$.pipe(queryChange<CountDownState, number>(CounterStateKeys.tickSpeed));
const countDiff$ = counterState$.pipe(queryChange<CountDownState, number>(CounterStateKeys.countDiff));

const counterUpdateTrigger$ = combineLatest(isTicking$, tickSpeed$).pipe(
  switchMap(([isTicking, tickSpeed]) => (isTicking ? timer(0, tickSpeed) : NEVER))
);

// = SIDE EFFECTS =========================================================

// == UI INPUTS ===========================================================
const renderCountChange$ = count$.pipe(tap((n) => counterUI.renderCounterValue(n)));
const renderTickSpeedChange$ = tickSpeed$.pipe(tap((n) => counterUI.renderTickSpeedInputValue(n)));
const renderCountDiffChange$ = countDiff$.pipe(tap((n) => counterUI.renderCountDiffInputValue(n)));
const renderSetToChange$ = counterUI.btnReset$.pipe(
  tap((_) => {
    counterUI.renderSetToInputValue('10');
  })
);

// == UI OUTPUTS ==========================================================
const commandFromTick$ = counterUpdateTrigger$.pipe(
  withLatestFrom(counterState$, (_, counterState) => ({
    [CounterStateKeys.count]: counterState.count,
    [CounterStateKeys.countUp]: counterState.countUp,
    [CounterStateKeys.countDiff]: counterState.countDiff
  })),
  tap(({ count, countUp, countDiff }) =>
    programmaticCommandSubject.next({ count: count + countDiff * (countUp ? 1 : -1) })
  )
);

// == SUBSCRIPTION ========================================================

merge(
  // Input side effect
  renderCountChange$,
  renderTickSpeedChange$,
  renderCountDiffChange$,
  renderSetToChange$,
  // Outputs side effect
  commandFromTick$
).subscribe();

// = HELPER ===============================================================
// = CUSTOM OPERATORS =====================================================
// == CREATION METHODS ====================================================
// == OPERATORS ===========================================================
function queryChange<T, I>(key: string): UnaryFunction<Observable<T>, Observable<I>> {
  return pipe(pluck<T, I>(key), distinctUntilChanged<I>());
}
