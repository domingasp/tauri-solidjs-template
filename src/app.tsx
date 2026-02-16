import { invoke } from "@tauri-apps/api/core";
import { type JSX, createSignal } from "solid-js";

const App = (): JSX.Element => {
  const [greetMsg, setGreetMsg] = createSignal("");
  const [name, setName] = createSignal("");

  const greet = async (): Promise<void> => {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name: name() }));
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

      <p>{greetMsg()}</p>
    </main>
  );
};

export default App;
