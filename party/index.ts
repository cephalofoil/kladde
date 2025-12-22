import type * as Party from "partykit/server";
import { onConnect } from "y-partykit";

export default class YjsServer implements Party.Server {
  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection) {
    // Ephemeral mode: data only exists in RAM during active sessions
    // No persistence to Cloudflare - perfect for temporary collaboration
    return onConnect(conn, this.room);
  }
}
