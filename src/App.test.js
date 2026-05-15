import { render, screen } from "@testing-library/react";
import App from "./App";

jest.mock("./MusicPlayer", () => {
  const React = require("react");
  const { Link } = require("react-router-dom");
  return {
    __esModule: true,
    default: function MusicPlayerStub() {
      return React.createElement(Link, { to: "/soap" }, "CP 비누 배합표 →");
    },
  };
});

test("renders home route inside router", () => {
  render(<App />);
  expect(screen.getByText(/CP 비누 배합표/)).toBeInTheDocument();
});
