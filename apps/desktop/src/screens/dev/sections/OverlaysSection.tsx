import { useState } from "react";
import { useTranslation } from "react-i18next";
import catalog from "@fixtures/catalog.json";
import channels from "@fixtures/channels.json";
import { AppIcon } from "@/components/AppIcon";
import { Button } from "@/components/Button";
import { Modal, ModalIcon } from "@/components/Modal";
import { Select } from "@/components/Select";
import { TextArea } from "@/components/TextArea";
import { Field, TextField } from "@/components/TextField";
import { Specimen, SpecimenGrid } from "./Gallery";
import styles from "./sections.module.css";

type Demo = "confirm" | "report" | "release" | "form" | null;

const APP = catalog.apps[0];
const OFFICIAL = channels.channels[0];

export function ModalSection() {
  const { t } = useTranslation();
  const [open, setOpen] = useState<Demo>(null);
  const [title, setTitle] = useState("");
  const close = () => setOpen(null);
  const footer = (confirm: string) => (
    <>
      <Button onClick={close}>{t("common.cancel")}</Button>
      <Button variant="primary" onClick={close}>
        {confirm}
      </Button>
    </>
  );

  return (
    <SpecimenGrid>
      <Specimen caption='Modal width=440 · 460 · 480 · 560 (layout="form")'>
        <Button size="sm" onClick={() => setOpen("confirm")}>
          440
        </Button>
        <Button size="sm" onClick={() => setOpen("report")}>
          460
        </Button>
        <Button size="sm" onClick={() => setOpen("release")}>
          480
        </Button>
        <Button size="sm" onClick={() => setOpen("form")}>
          560
        </Button>
      </Specimen>

      <Modal
        open={open === "confirm"}
        onClose={close}
        title={t("subscription.proActive")}
        icon={
          OFFICIAL ? <AppIcon mono={OFFICIAL.mono} tint={OFFICIAL.tint} size={36} /> : undefined
        }
        footer={footer(t("subscription.confirm"))}
      >
        <p>{t("subscription.subBody")}</p>
      </Modal>

      <Modal
        open={open === "report"}
        width={460}
        onClose={close}
        title={t("common.reportProblem")}
        icon={<ModalIcon name="flag" tone="neutral" />}
        footer={footer(t("report.send"))}
      >
        <p>{t("report.reportRouteOfficial")}</p>
        <TextArea
          aria-label={t("report.reportPlaceholder")}
          placeholder={t("report.reportPlaceholder")}
          fieldClassName={styles.modalField}
        />
      </Modal>

      <Modal
        open={open === "release"}
        width={480}
        onClose={close}
        title={t("idea.releaseIdea")}
        subtitle={APP?.name}
        icon={<ModalIcon name="package" />}
        footer={footer(t("idea.release"))}
      >
        <div className={styles.modalFields}>
          <Field label={t("idea.releaseApp")}>
            {(control) => (
              <Select
                {...control}
                size="lg"
                ground="input"
                fullWidth
                value={APP?.id ?? ""}
                onChange={() => {}}
                options={catalog.apps.slice(0, 4).map((a) => ({ value: a.id, label: a.name }))}
              />
            )}
          </Field>
          <TextField size="lg" label={t("idea.releaseVersion")} mono defaultValue={APP?.version} />
        </div>
      </Modal>

      <Modal
        open={open === "form"}
        width={560}
        layout="form"
        onClose={close}
        closeLabel={t("common.close")}
        title={t("ideas.suggestIdea")}
        icon={<ModalIcon name="lightbulb" />}
        footerNote={t("ideas.ideaFooter")}
        footer={footer(t("ideas.publish"))}
      >
        <div className={styles.modalFields}>
          <TextField
            size="lg"
            label={t("ideas.ideaTitle")}
            placeholder={t("ideas.ideaTitlePlaceholder")}
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            error={title !== "" && title.trim().length < 6 ? t("ideas.ideaTitleShort") : undefined}
          />
          <TextArea
            label={t("ideas.ideaBody")}
            placeholder={t("ideas.ideaBodyPlaceholder")}
            rows={5}
          />
        </div>
      </Modal>
    </SpecimenGrid>
  );
}
