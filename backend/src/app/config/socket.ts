import { Server as HttpServer } from "http";
import { Server, Socket } from "socket.io";
import type {
  ZoneStateEvent,
  PriorityUpdateEvent,
  IncidentOpenedEvent,
  IncidentAckedEvent,
  IncidentResolvedEvent,
  ZoneOfflineEvent,
} from "../types/contract.js";

let io: Server | null = null;

export function initSocket(server: HttpServer, frontendUrl: string): Server {
  io = new Server(server, {
    cors: { origin: frontendUrl, credentials: true },
  });

  io.on("connection", (socket: Socket) => {
    console.log("Dashboard connected:", socket.id);
    socket.on("disconnect", () => {
      console.log("Dashboard disconnected:", socket.id);
    });
  });

  return io;
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized yet!");
  }
  return io;
}

export function broadcastZoneState(payload: ZoneStateEvent) {
  if (io) io.emit("zone:state", payload);
}

export function broadcastPriorityUpdate(payload: PriorityUpdateEvent) {
  if (io) io.emit("priority:update", payload);
}

export function broadcastIncidentOpened(payload: IncidentOpenedEvent) {
  if (io) io.emit("incident:opened", payload);
}

export function broadcastIncidentAcked(payload: IncidentAckedEvent) {
  if (io) io.emit("incident:acked", payload);
}

export function broadcastIncidentResolved(payload: IncidentResolvedEvent) {
  if (io) io.emit("incident:resolved", payload);
}

export function broadcastZoneOffline(payload: ZoneOfflineEvent) {
  if (io) io.emit("zone:offline", payload);
}
