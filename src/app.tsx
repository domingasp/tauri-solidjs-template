import type { JSX } from "solid-js";

import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";

const App = (): JSX.Element => {
  const [greetMessage, setGreetMessage] = createSignal("");
  const [name, setName] = createSignal("");

  /** Invoke rust `greet` command. */
  const greet = async (): Promise<void> => {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMessage(await invoke("greet", { name: name() }));
  };

  return (
    <main class="container">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void greet();
        }}
      >
        <input
          onChange={(event) => setName(event.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>

      <p>{greetMessage()}</p>
    </main>
  );
};

export default App;
