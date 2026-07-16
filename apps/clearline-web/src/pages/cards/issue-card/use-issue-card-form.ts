import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { CardholderCandidate, MerchantCategory } from '@clearline/contracts';
import {
  useIssueCard,
  useIssueCardContext,
  CardsForbiddenError,
  CardIssueError,
} from '@clearline/data-access-cards';
import { parseAmountToMinorUnits } from '@clearline/money';

const CURRENCY = 'USD';

export interface IssueCardFormView {
  forbidden: boolean;
  isLoadingContext: boolean;
  candidates: CardholderCandidate[];
  categories: MerchantCategory[];
  holderId: string;
  selectHolder: (id: string) => void;
  selectedHolder: CardholderCandidate | undefined;
  limitInput: string;
  setLimitInput: (value: string) => void;
  /** Parsed monthly limit in minor units, or null when the field is empty/malformed. */
  limitMinorUnits: number | null;
  selectedMccs: string[];
  toggleMcc: (code: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  submit: () => void;
  error: CardIssueError | null;
}

/**
 * The issuance form's state and submission (US-CW-014 AC-01). Holds the chosen cardholder, the parsed
 * monthly limit, and the selected MCC restrictions; on submit it issues the card and routes to its new
 * detail feed. All money parsing goes through @clearline/money so the client and server agree on units.
 */
export function useIssueCardForm(): IssueCardFormView {
  const navigate = useNavigate();
  const context = useIssueCardContext();
  const issue = useIssueCard();

  const [holderId, setHolderId] = useState('');
  const [limitInput, setLimitInput] = useState('');
  const [selectedMccs, setSelectedMccs] = useState<string[]>([]);

  const candidates = context.data?.candidates ?? [];
  const categories = context.data?.merchantCategories ?? [];
  const limitMinorUnits =
    limitInput.trim() === '' ? null : parseAmountToMinorUnits(limitInput, CURRENCY);
  const canSubmit =
    holderId !== '' && limitMinorUnits !== null && limitMinorUnits > 0 && !issue.isPending;

  const toggleMcc = (code: string) =>
    setSelectedMccs((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );

  const submit = () => {
    if (!canSubmit || limitMinorUnits === null) return;
    issue.mutate(
      {
        holderId,
        monthlyLimit: { amountMinorUnits: limitMinorUnits, currency: CURRENCY },
        allowedMccs: selectedMccs,
      },
      { onSuccess: (data) => navigate(`/cards/${data.card.id}`) },
    );
  };

  return {
    forbidden: context.error instanceof CardsForbiddenError,
    isLoadingContext: context.isPending,
    candidates,
    categories,
    holderId,
    selectHolder: setHolderId,
    selectedHolder: candidates.find((c) => c.id === holderId),
    limitInput,
    setLimitInput,
    limitMinorUnits,
    selectedMccs,
    toggleMcc,
    canSubmit,
    isSubmitting: issue.isPending,
    submit,
    error: issue.error instanceof CardIssueError ? issue.error : null,
  };
}
