import { ACTIONS, DIRECTIONS, type Vec } from "./constants";
import type { State } from "./interpreter";
import { PyRandom } from "./random";

export type QTable = number[][];

export interface AgentParams {
  explorationRate: number;
  learningRate: number;
  decay: number;
}

export const DEFAULT_AGENT_PARAMS: AgentParams = {
  explorationRate: 0.05,
  learningRate: 0.1,
  decay: 0.8,
};

export class Agent {
  explorationRate: number;
  learningRate: number;
  decay: number;
  states: QTable = [];
  private rng = new PyRandom();

  constructor(params: Partial<AgentParams> = {}) {
    const p = { ...DEFAULT_AGENT_PARAMS, ...params };
    this.explorationRate = p.explorationRate;
    this.learningRate = p.learningRate;
    this.decay = p.decay;
  }

  setParams(params: Partial<AgentParams>): void {
    if (params.explorationRate !== undefined) this.explorationRate = params.explorationRate;
    if (params.learningRate !== undefined) this.learningRate = params.learningRate;
    if (params.decay !== undefined) this.decay = params.decay;
  }

  /** Returns [action index into the state's sorted actions, direction vector]. */
  chooseDirection(state: State): [number, Vec] {
    const [serial, possibleDirections, lowestReward] = state;
    const row = this.states[serial];
    let action: number;

    if (this.rng.random() < this.explorationRate) {
      action = this.rng.randrange(0, possibleDirections.length);

      // If choosing an action that will instantly lose, choose something else instead
      let attempts = 0;
      while (
        row[action] < lowestReward * this.learningRate * this.decay &&
        attempts < 100
      ) {
        action = this.rng.randrange(0, possibleDirections.length);
        attempts++;
      }
    } else {
      action = argmax(row);
    }

    const direction = DIRECTIONS[ACTIONS.indexOf(possibleDirections[action])];
    return [action, [direction[0], direction[1]]];
  }

  updateStates(previousState: State, newState: State, action: number, reward: number): void {
    const prev = previousState[0];
    const next = newState[0];

    const scoreBeforeAction = this.states[prev][action];
    const maxScoreAfterAction = next >= 0 ? Math.max(...this.states[next]) : next;

    this.states[prev][action] =
      this.learningRate * scoreBeforeAction +
      this.learningRate * (reward + this.decay * maxScoreAfterAction);
  }
}

/** numpy.argmax: index of the first maximum (NaN counts as the maximum). */
function argmax(values: number[]): number {
  let best = 0;
  for (let i = 0; i < values.length; i++) {
    if (Number.isNaN(values[i])) return i;
    if (values[i] > values[best]) best = i;
  }
  return best;
}
