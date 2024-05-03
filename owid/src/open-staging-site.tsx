import {
  List,
  ActionPanel,
  Action,
  Icon,
  open,
  Keyboard,
  showToast,
  Toast,
  Clipboard,
} from "@raycast/api";
import { usePullRequests, linkIcon } from "./utils";
import { usePromise } from "@raycast/utils";

const GITHUB_REPO = "owid/owid-grapher";
const GITHUB_USER_NAME = "sophiamersmann";

const BROWSER_PATH = "/Applications/Google Chrome.app";
const BROWSER_NAME = "Google Chrome";

const ARC_PATH = "/Applications/Arc.app";

export default function Command() {
  const { data: clipboardText = "", isLoading: isLoadingClipboardText } =
    usePromise(Clipboard.readText, [], {
      onError: async () => {
        showToast(Toast.Style.Failure, "Failed to read clipboard content");
      },
    });

  const { pullRequests, isLoading: isLoadingPullRequests } = usePullRequests(
    GITHUB_REPO,
    GITHUB_USER_NAME,
  );

  const maybeUrl = clipboardText.trim();

  let urlPath = "";

  try {
    const url = new URL(maybeUrl);
    urlPath = url.pathname + url.search;
  } catch (error) {
    // intentionally empty
  }

  const makeUrl = (baseUrl: string) => baseUrl + urlPath;

  const isLoading = isLoadingClipboardText || isLoadingPullRequests;

  return (
    <List isLoading={isLoading}>
      {pullRequests.map((pr) => (
        <List.Item
          key={pr.branch}
          title={makeUrl(pr.staging)}
          icon={linkIcon}
          accessories={[{ date: pr.updatedAt }]}
          actions={
            <ActionPanel>
              <Action
                title={`Open in ${BROWSER_NAME}`}
                icon={Icon.Globe}
                onAction={() => open(makeUrl(pr.staging), BROWSER_PATH)}
              />
              <Action
                title="Open in Little Arc"
                icon={Icon.Globe}
                onAction={() => open(makeUrl(pr.staging), ARC_PATH)}
              />
              <Action
                title={`Open Homepage in ${BROWSER_NAME}`}
                icon={Icon.Globe}
                onAction={() => open(pr.staging, BROWSER_NAME)}
              />
              <Action
                title={`Open Homepage in Little Arc`}
                icon={Icon.Globe}
                onAction={() => open(pr.staging, ARC_PATH)}
              />
              <Action.CopyToClipboard
                title="Copy Link"
                content={makeUrl(pr.staging)}
                shortcut={Keyboard.Shortcut.Common.Copy}
              />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
