import { expect, describe, test, vi, Mock, beforeEach, afterEach } from 'vitest';
import { getWebsocketController, WebsocketController } from '../controllers';
import emitter from '../../emitter';
import type { WebSocketClient } from '../types';
import { HeartbeatHandler } from './heartbeat';
import type { EventContext } from '@directus/shared/types';

// mocking
vi.mock('../controllers', () => ({
	getWebsocketController: vi.fn(() => ({
		clients: new Set(),
	})),
}));
vi.mock('../../env', async () => {
	const actual = (await vi.importActual('../../env')) as { default: Record<string, any> };
	const MOCK_ENV = {
		...actual.default,
		WEBSOCKETS_HEARTBEAT_FREQUENCY: 1,
	};
	return {
		default: MOCK_ENV,
		getEnv: () => MOCK_ENV,
	};
});
function mockClient() {
	return {
		on: vi.fn(),
		off: vi.fn(),
		send: vi.fn(),
		close: vi.fn(),
	} as unknown as WebSocketClient;
}

describe('Websocket heartbeat handler', () => {
	let controller: WebsocketController;
	beforeEach(() => {
		vi.useFakeTimers();
		controller = getWebsocketController();
	});
	afterEach(() => {
		vi.useRealTimers();
		vi.clearAllMocks();
	});

	test('client should ping', async () => {
		// initialize handler
		new HeartbeatHandler(controller);
		// connect fake client
		const fakeClient = mockClient();
		(fakeClient.send as Mock).mockImplementation(() => {
			//respond with a message
			emitter.emitAction('websocket.message', { client: fakeClient, message: { type: 'pong' } }, {} as EventContext);
		});
		controller.clients.add(fakeClient);
		emitter.emitAction('websocket.connect', {}, {} as EventContext);
		// wait for ping
		vi.advanceTimersByTime(1000); // 1sec heartbeat interval
		expect(fakeClient.send).toBeCalled();
		// wait for another timeout
		vi.advanceTimersByTime(1000); // 1sec heartbeat interval
		expect(fakeClient.send).toBeCalled();
		// the connection should not have been closed
		expect(fakeClient.close).not.toBeCalled();
	});
	test('connection should be closed', async () => {
		// initialize handler
		new HeartbeatHandler(controller);
		// connect fake client
		const fakeClient = mockClient();
		controller.clients.add(fakeClient);
		emitter.emitAction('websocket.connect', {}, {} as EventContext);
		vi.advanceTimersByTime(2 * 1000); // 2x 1sec heartbeat interval
		expect(fakeClient.send).toBeCalled();
		// the connection should have been closed
		expect(fakeClient.close).toBeCalled();
	});
	test('the server should pong if the client pings', async () => {
		// initialize handler
		new HeartbeatHandler(controller);
		// connect fake client
		const fakeClient = mockClient();
		controller.clients.add(fakeClient);
		emitter.emitAction('websocket.connect', {}, {} as EventContext);
		emitter.emitAction('websocket.message', { client: fakeClient, message: { type: 'ping' } }, {} as EventContext);
		expect(fakeClient.send).toBeCalled();
	});
});
