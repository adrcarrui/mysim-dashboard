import {
  AirbusPage,
  AirbusCard,
  AirbusBadge,
  AirbusButton,
} from "../../airbus-ui";

export function AirbusDemo() {
  return (
    <AirbusPage
      title="Operations Overview"
      subtitle="Simulation Engineering"
      eyebrow="mySim"
      highlight="cyan"
    >
      <div className="airbus-demo__grid">
        <AirbusCard
          title="Open jobs"
          subtitle="Current operational workload"
          accent="cyan"
        >
          <div className="airbus-demo__metric">
            <strong>12</strong>

            <AirbusBadge variant="warning" dot>
              Active
            </AirbusBadge>
          </div>
        </AirbusCard>

        <AirbusCard
          title="Open DRs"
          subtitle="Pending resolution"
          accent="orange"
        >
          <div className="airbus-demo__metric">
            <strong>4</strong>

            <AirbusBadge variant="danger" dot>
              Attention
            </AirbusBadge>
          </div>
        </AirbusCard>

        <AirbusCard
          title="Upcoming tasks"
          subtitle="Next 7 days"
          accent="green"
        >
          <div className="airbus-demo__metric">
            <strong>18</strong>

            <AirbusBadge variant="success" dot>
              Planned
            </AirbusBadge>
          </div>
        </AirbusCard>
      </div>

      <AirbusCard
        title="Recent activity"
        subtitle="Latest operational items"
      >
        <AirbusButton variant="secondary">
          View details
        </AirbusButton>
      </AirbusCard>
    </AirbusPage>
  );
}