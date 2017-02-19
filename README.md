MVTSWP
======

Welcome to the Minimum Viable TypeScript Webpack app!

Requirements
---

Install dependencies:
---
        $ npm install


Build, view, build, view, ...
---
1. Build the app once:

        $ npm run build

2. Open ./index.html

3. Modify the app in src/index.ts

4. Build it again:

        $ npm run build

5. Refresh the browser. Did you see your change? Nice!

Automatigically build
---

1. Run webpack in dev mode so it recompiles / rebundles each time the
   source changes:

        $ npm run dev

2. Now you can modify the source and refresh the browser without doing
   a build on the commandline. Nicer!

Automagically build and refresh
---

1. Finally, you can run the webpack-dev-server so the app is served up
   by a web server.

        $ npm start

2. Now you can open the app and see live changes: http://localhost:8080/webpack-dev-server/
