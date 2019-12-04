import { useState, useEffect } from 'react';
import { StateMachine, EventObject, interpret } from '@xstate/fsm';
import { AnyEventObject } from 'xstate';

// TS enums don't tree-shake well
const NotStarted = 'not started';
const Running = 'running';
const Stopped = 'stopped';

type InterpreterStatus = typeof NotStarted | typeof Running | typeof Stopped;

const interpretDev: typeof interpret = machine => {
  const service = interpret(machine);
  let status: InterpreterStatus = NotStarted;

  return {
    send: event => {
      if (status !== Running) {
        console.error(
          `Sending events to a machine in "${status}" state might lead to unexpected results.\n` +
            `If you want to send events to a machine you should do it after React's commit phase (so after the moment when the interpreter actually starts).`
        );
      }
      service.send(event);
    },
    subscribe: service.subscribe,
    start: () => {
      status = Running;
      return service.start();
    },
    stop: () => {
      status = Stopped;
      return service.stop();
    }
  };
};

export function useMachine<TC, TE extends EventObject = AnyEventObject>(
  stateMachine: StateMachine.Machine<TC, TE, any>
): [
  StateMachine.State<TC, TE, any>,
  StateMachine.Service<TC, TE>['send'],
  StateMachine.Service<TC, TE>
] {
  const initializeState = () => ({
    machine: stateMachine,
    service:
      process.env.NODE_ENV !== 'production'
        ? interpretDev(stateMachine)
        : interpret(stateMachine),
    state: stateMachine.initialState
  });
  const [{ state, service, machine }, setState] = useState(initializeState);

  if (stateMachine !== machine) {
    setState(initializeState());
  }

  useEffect(() => {
    service.subscribe(state =>
      setState(prevState => ({ ...prevState, state }))
    );
    service.start();
    return () => {
      service.stop();
    };
  }, [service]);

  return [state, service.send, service];
}
