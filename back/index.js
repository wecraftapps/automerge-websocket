const express = require('express');
const app = express();
const http = require('http');
const { Server } = require("socket.io");

const Automerge = require('@automerge/automerge');

let syncStates = [];  // List to keep track of the synchronisation state of all connected clients

let doc = Automerge.init();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: 'http://localhost:8080',
    methods: ['GET', 'POST'],
  },
});

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('disconnect', () => {
    console.log('user disconnected');
  });

  /**
   * Event called when a client has updates to give
   */
  socket.on('CLIENT_SYNC', (data) => {
    const tmpSyncMsg = Buffer.from(data.syncMessage, 'base64');

    // We check if the client is already tracked in our list
    const currentSyncState = syncStates.find((syncSt) => syncSt.socketId === socket.id);

    if (currentSyncState) {
      // If the client is already tracked
      // We update his synchronisation status
      const [nextDoc, nextSyncState, patch] = Automerge.receiveSyncMessage(
        doc,
        currentSyncState.state,
        tmpSyncMsg,
      );

      console.log(`*** doc ***`);
      console.log(doc.items);

      doc = nextDoc;
      console.log(`*** nextDoc ***`);
      console.log(nextDoc.items);

      doc = nextDoc;

      // There we update the synchronisation status of the client in our list
      syncStates = syncStates.map((syncSt) => {
        if (syncSt.socketId === socket.id) {
          return {
            ...syncSt,
            state: nextSyncState,
          }
        }

        return syncSt;
      });
    } else {
      // If the client is not already tracked, we create a new entry in our list and initiate a SyncState
      syncStates.push({
        actorId: data.actorId,
        socketId: socket.id,
        state: Automerge.initSyncState(),
      });
    }

    // After having possibly updated our document with a client update, we check if any client has their document out of sync
    updatePeers();
  });
});

/**
 * Function that browse our list of tracked clients and sends them a SyncMessage if their document is out of sync with our local document
 * 
 * source : https://automerge.org/docs/cookbook/real-time/#sync-protocol
 */
const updatePeers = () => {
  syncStates.map((syncState) => {
    let tmpState = null;

    try {
      const [nextSyncState, syncMessage] = Automerge.generateSyncMessage(
        doc,
        syncState.state,
      );

      // If the client is indeed out of sync and needs an update
      if (syncMessage) {
        io.to(syncState.socketId).emit('UPDATE_SYNC_STATE', {
          syncMessage: Buffer.from(syncMessage).toString('base64'),
        });
      }

      tmpState = nextSyncState;
    } catch (e) {
      console.log(e);
    }

    // There we update the synchronisation state of the client if he needed an update
    return {
      ...syncState,
      ...(tmpState && { state: tmpState }),
    };
  });
}

/**
 *** SERVER INITIALIZATION ***
 */
server.listen(5010, () => {
  console.log('listening on *:5010');

  // We fill the document with one value by default
  const first = Automerge.change(doc, (doc) => {
    doc.items = [];
    doc.items.push({ text: 'lorem', done: false });
  });

  doc = first;
});
