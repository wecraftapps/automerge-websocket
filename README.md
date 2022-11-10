This repository is an example of an implementation using [Automerge](https://automerge.org/).

The code is based on [the tutorial](https://automerge.org/docs/tutorial/introduction/) given by the docs of Automerge.

Realtime collaboration is achieved using websockets.

### What you will find in this repo

You'll find a client (under `front/` folder) which consists in a todo list.

And you'll find a server (under `back/` folder) which consists in a websocket server.

The [Sync Protocol](https://automerge.org/docs/how-it-works/sync/) is used to share changes.

### How to

You'll find setup details in each folder.

Once front and back initialized and started, you can open several pages `http://localhost:8080/` and see the same todo list being shared across all clients. If one client makes changes, every other client is informed.

You also can trigger the network status of each client, if you want to test the offline mode.

### Demo

![](https://media.giphy.com/media/leJVycdI6eD5zjjRS4/giphy.gif)
