import { TestAppI18nProvider } from "@canva/app-i18n-kit";
import { TestAppUiProvider } from "@canva/app-ui-kit";
import { render } from "@testing-library/react";
import type { RenderResult } from "@testing-library/react";
import type { ReactNode } from "react";
import { App } from "../app";

function renderInTestProvider(node: ReactNode): RenderResult {
  return render(
    <TestAppI18nProvider>
      <TestAppUiProvider>{node}</TestAppUiProvider>
    </TestAppI18nProvider>
  );
}

describe("Image Meta Cleaner Tests", () => {
  it("should render the app title", () => {
    const result = renderInTestProvider(<App />);
    expect(result.getByText("Image Meta Cleaner")).toBeTruthy();
  });

  it("should render the description text", () => {
    const result = renderInTestProvider(<App />);
    expect(result.getByText(/Remove hidden metadata/i)).toBeTruthy();
  });

  it("should have a consistent snapshot", () => {
    const result = renderInTestProvider(<App />);
    expect(result.container).toMatchSnapshot();
  });
});
