import "./styles/global.css";
/* @refresh reload */
import { render } from "solid-js/web";

import App from "./app";

const root = document.querySelector<HTMLElement>("#root");
if (root === null) throw new Error("Root element not found");

render(() => <App />, root);
