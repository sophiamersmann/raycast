import { uuidv7 } from "uuidv7";
import { useState } from "react";
import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Form,
  Icon,
  Keyboard,
  List,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { FormValidation, useForm } from "@raycast/utils";

import {
  byCreatedAt,
  loadCharts,
  makeThumbnailUrl,
  persistCharts,
} from "./utils/helpers";
import { OpenInArcAction, OpenInBrowserAction } from "./utils/components";
import { CHART_TYPE_DATA, CHART_TYPES } from "./utils/constants";
import { Chart, ChartType } from "./utils/types";

export default function Command() {
  const data = loadCharts();

  const [charts, setCharts] = useState<Chart[]>(data.charts.sort(byCreatedAt));
  const [showingDetail, setShowingDetail] = useState(false);

  function updateCharts(charts: Chart[]) {
    setCharts(charts);
    persistCharts({ charts });
  }

  function handleCreate(chart: Chart) {
    const isDuplicate = charts.some((c) => c.url === chart.url);

    if (isDuplicate) {
      showToast({
        style: Toast.Style.Failure,
        title: "Failure",
        message: "Chart already exists",
      });
      return;
    }

    const newCharts = [...charts, chart].sort(byCreatedAt);
    updateCharts(newCharts);

    showToast({
      style: Toast.Style.Success,
      title: "Success",
      message: "Chart saved",
    });
  }

  function handleUpdate(chart: Chart) {
    const newCharts = [...charts];
    const index = newCharts.findIndex((c) => c.id === chart.id);
    newCharts[index] = chart;
    updateCharts(newCharts);

    showToast({
      style: Toast.Style.Success,
      title: "Success",
      message: "Chart updated",
    });
  }

  function handleDelete(chart: Chart) {
    const newCharts = [...charts];
    const index = newCharts.findIndex((c) => c.id === chart.id);
    newCharts.splice(index, 1);
    updateCharts(newCharts);

    showToast({
      style: Toast.Style.Success,
      title: "Success",
      message: "Chart deleted",
    });
  }

  return (
    <List
      actions={
        <ActionPanel>
          <CreateChartAction onCreate={handleCreate} />
        </ActionPanel>
      }
      isShowingDetail={showingDetail}
    >
      {charts.map((chart) => (
        <List.Item
          key={chart.tagLine}
          title={chart.tagLine}
          subtitle={CHART_TYPE_DATA[chart.chartType as ChartType].name}
          accessories={[{ date: new Date(chart.createdAt) }]}
          keywords={[
            chart.chartType,
            CHART_TYPE_DATA[chart.chartType as ChartType].name,
          ]}
          icon={
            chart.chartType === "WorldMap"
              ? {
                  source: Icon.Globe,
                  tintColor: {
                    light: Color.SecondaryText,
                    dark: Color.SecondaryText,
                    adjustContrast: true,
                  },
                }
              : {
                  source: Icon.LineChart,
                  tintColor: {
                    light: Color.SecondaryText,
                    dark: Color.SecondaryText,
                    adjustContrast: true,
                  },
                }
          }
          detail={
            <List.Item.Detail
              markdown={`![Chart](${makeThumbnailUrl(chart.url)})`}
              metadata={
                <Detail.Metadata>
                  <Detail.Metadata.Label
                    title="Tag Line"
                    text={chart.tagLine}
                  />
                  <Detail.Metadata.TagList title="Chart Type">
                    <Detail.Metadata.TagList.Item
                      text={CHART_TYPE_DATA[chart.chartType as ChartType].name}
                      color={Color.Purple}
                    />
                  </Detail.Metadata.TagList>
                  <Detail.Metadata.Label
                    title="Created at"
                    text={chart.createdAt.toDateString()}
                  />
                  <Detail.Metadata.Separator />
                  <Detail.Metadata.Link
                    title="Url"
                    target={chart.url}
                    text={
                      chart.type === "explorer"
                        ? "Explorer Page"
                        : "Grapher Page"
                    }
                  />
                </Detail.Metadata>
              }
            />
          }
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                <OpenChartAction chart={chart} browser="chrome" />
                <OpenChartAction chart={chart} browser="arc" />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action.CopyToClipboard
                  title="Copy Link"
                  content={chart.url}
                  shortcut={Keyboard.Shortcut.Common.Copy}
                />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <CreateChartAction onCreate={handleCreate} />
                <UpdateChartAction
                  chart={chart}
                  onUpdate={() => handleUpdate(chart)}
                />
                <DeleteChartAction onDelete={() => handleDelete(chart)} />
              </ActionPanel.Section>
              <ActionPanel.Section>
                <Action
                  icon={showingDetail ? Icon.ArrowsContract : Icon.ArrowsExpand}
                  title="Toggle Preview"
                  shortcut={{ modifiers: ["cmd"], key: "d" }}
                  onAction={() => setShowingDetail(!showingDetail)}
                />
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

function CreateChartForm(props: { onSubmit: (chart: Chart) => void }) {
  return <ChartForm onSubmit={props.onSubmit} submitLabel="Save chart" />;
}

function UpdateChartForm(props: {
  defaults?: Chart;
  onSubmit: (chart: Chart) => void;
}) {
  return (
    <ChartForm
      onSubmit={props.onSubmit}
      defaults={props.defaults}
      submitLabel="Update chart"
    />
  );
}

function ChartForm(props: {
  defaults?: Chart;
  submitLabel?: string;
  onSubmit: (chart: Chart) => void;
}) {
  const { pop } = useNavigation();

  interface FormValues {
    url: string;
    chartType: string;
    tagLine: string;
    project?: string;
    group?: string;
  }

  const { handleSubmit, itemProps } = useForm<FormValues>({
    onSubmit(data) {
      const isExplorer = data.url.includes("/explorers/");

      props.onSubmit({
        id: uuidv7(),
        chartType: data.chartType,
        url: data.url,
        type: isExplorer ? "explorer" : "grapher",
        tagLine: data.tagLine,
        createdAt: new Date(),
      });
      pop();
    },
    validation: {
      url: FormValidation.Required,
      tagLine: FormValidation.Required,
      chartType: FormValidation.Required,
    },
  });

  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm
            title={props.submitLabel}
            onSubmit={handleSubmit}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="chartType"
        title="Chart Type"
        defaultValue={props.defaults?.chartType}
      >
        {[...CHART_TYPES, "WorldMap"].map((chartType) => (
          <Form.Dropdown.Item
            key={chartType}
            value={chartType}
            title={chartType}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField
        title="Tag Line"
        defaultValue={props.defaults?.tagLine}
        {...itemProps.tagLine}
      />
      <Form.TextField
        title="Url"
        defaultValue={props.defaults?.url}
        {...itemProps.url}
      />
    </Form>
  );
}

function OpenChartAction({
  chart,
  browser,
}: {
  chart: Chart;
  browser: "arc" | "chrome";
}) {
  switch (browser) {
    case "chrome":
      return <OpenInBrowserAction url={chart.url} />;
    case "arc":
      return <OpenInArcAction url={chart.url} />;
  }
}

function CreateChartAction(props: { onCreate: (chart: Chart) => void }) {
  return (
    <Action.Push
      icon={Icon.Pencil}
      title="Create Chart"
      shortcut={{ modifiers: ["cmd"], key: "n" }}
      target={<CreateChartForm onSubmit={props.onCreate} />}
    />
  );
}

function UpdateChartAction(props: {
  chart: Chart;
  onUpdate: (chart: Chart) => void;
}) {
  return (
    <Action.Push
      icon={Icon.Pencil}
      title="Update Chart"
      shortcut={{ modifiers: ["cmd"], key: "u" }}
      target={
        <UpdateChartForm defaults={props.chart} onSubmit={props.onUpdate} />
      }
    />
  );
}

function DeleteChartAction(props: { onDelete: () => void }) {
  return (
    <Action
      icon={Icon.Trash}
      title="Delete Chart"
      shortcut={{ modifiers: ["ctrl"], key: "x" }}
      onAction={props.onDelete}
    />
  );
}
