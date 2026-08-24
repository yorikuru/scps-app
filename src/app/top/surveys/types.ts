export type QuestionType = 
  | "text" | "textarea" | "radio" | "checkbox" | "select" | "file" 
  | "scale" | "rating" | "ranking" | "grid_radio" | "grid_checkbox" 
  | "date" | "time" | "section" | "description";

export type Question = {
  id: string;
  type: QuestionType;
  title: string;
  description?: string;
  options: string[];
  required: boolean;
  
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;

  ratingMax?: number; 
  ratingIcon?: "star" | "heart" | "thumb";

  gridRows?: string[]; 
  gridCols?: string[]; 

  checkboxConstraintType?: "none" | "exact" | "min" | "max";
  checkboxConstraintCount?: number;

  points?: number;
  correctAnswers?: string[];
  feedback?: string;
  quizScoringType?: "all_match" | "partial_match";
};

export type SurveyAccessTarget = "tenant_members" | "external_users" | "selected_users" | "public";
export type SurveyVisibility = "private" | "selected_users" | "tenant_all";

export type SurveySettings = {
  visibility: SurveyVisibility; 
  editorIds: string[];
  accessTarget: SurveyAccessTarget;
  respondentIds: string[];
  requiredRespondentIds: string[];
  collectRespondentInfo: boolean; 
  acceptingResponses: boolean;
  confirmationMessage: string;

  isQuiz?: boolean;
  releaseGrades?: "immediately" | "manual" | "never";
  showMissedQuestions?: boolean;
  showCorrectAnswers?: boolean;
  showPointValues?: boolean;
  defaultPoints?: number;
  
  collectEmail?: boolean;
  sendResponseCopy?: "off" | "when_requested" | "always";
  allowEditResponse?: boolean;
  limitToOneResponse?: boolean;

  showProgressBar?: boolean;
  shuffleQuestions?: "off" | "all" | "except_locked";
  lockedQuestionRange?: string;
  showQuestionNumbers?: boolean;
  showLinkToSubmitAnother?: boolean;
  showResultsSummary?: boolean;
  disableAutosave?: boolean;
  allowSaveAndContinue?: boolean;

  startDate?: string | null;
  endDate?: string | null;
  timeLimit?: number | null;
};

export type Survey = {
  id: string;
  title: string;
  description: string;
  tenantId: string;
  createdBy: string;
  createdAt?: string;
  updatedAt?: string;
  settings: SurveySettings;
  questions: Question[];
  responsesCount?: number; 
};

export type UserData = {
  id: string;
  name: string;
  schoolId: string;
  role: string;
  systemId?: string;
  isITManager?: boolean;
};

export type ExistingResponse = {
  id: string;
  rawAnswers: Record<string, any>;
  manualScores?: Record<string, number>;
  email: string | null;
  respondentName: string;
};

export const getDefaultSurveySettings = (): SurveySettings => ({
  visibility: "tenant_all",
  editorIds: [],
  accessTarget: "tenant_members",
  respondentIds: [],
  requiredRespondentIds: [],
  collectRespondentInfo: true,
  isQuiz: false,
  releaseGrades: "immediately",
  showMissedQuestions: true,
  showCorrectAnswers: true,
  showPointValues: true,
  defaultPoints: 0,
  acceptingResponses: true,
  collectEmail: true,
  allowEditResponse: false,
  limitToOneResponse: false,
  showProgressBar: true,
  shuffleQuestions: "off",
  lockedQuestionRange: "",
  showQuestionNumbers: true,
  showLinkToSubmitAnother: true,
  showResultsSummary: false,
  confirmationMessage: "回答が送信されました。",
  disableAutosave: false,
  startDate: null,
  endDate: null,
  timeLimit: null,
});

// 管理用・回答用の両方でインポートできるように名前を2つエクスポート
export const sanitizeSurveyData = (data: any, defaults: SurveySettings): Survey => {
  return {
    id: data.id,
    title: data.title,
    description: data.description,
    tenantId: data.tenantId,
    createdBy: data.createdBy || "",
    createdAt: data.createdAt || "",
    updatedAt: data.updatedAt || "",
    settings: {
      ...defaults,
      ...data.settings,
      accessTarget: data.settings?.accessTarget ?? (data.isPublic ? 'public' : defaults.accessTarget),
      respondentIds: data.settings?.respondentIds || [],
      collectRespondentInfo: data.settings?.collectRespondentInfo ?? !(data.settings?.isAnonymous ?? data.isAnonymous ?? !defaults.collectRespondentInfo),
      acceptingResponses: data.settings?.acceptingResponses ?? data.isActive ?? defaults.acceptingResponses,
      confirmationMessage: data.settings?.confirmationMessage || defaults.confirmationMessage,
      
      isQuiz: data.settings?.isQuiz ?? defaults.isQuiz,
      releaseGrades: data.settings?.releaseGrades ?? defaults.releaseGrades,
      showPointValues: data.settings?.showPointValues ?? defaults.showPointValues,
      showMissedQuestions: data.settings?.showMissedQuestions ?? defaults.showMissedQuestions,
      showCorrectAnswers: data.settings?.showCorrectAnswers ?? defaults.showCorrectAnswers,
      collectEmail: data.settings?.collectEmail ?? defaults.collectEmail,
      allowEditResponse: data.settings?.allowEditResponse ?? defaults.allowEditResponse,
      limitToOneResponse: data.settings?.limitToOneResponse ?? defaults.limitToOneResponse,
      showProgressBar: data.settings?.showProgressBar ?? defaults.showProgressBar,
      shuffleQuestions: data.settings?.shuffleQuestions ?? defaults.shuffleQuestions,
      lockedQuestionRange: data.settings?.lockedQuestionRange ?? defaults.lockedQuestionRange,
      showQuestionNumbers: data.settings?.showQuestionNumbers ?? defaults.showQuestionNumbers,
      showLinkToSubmitAnother: data.settings?.showLinkToSubmitAnother ?? defaults.showLinkToSubmitAnother,
      showResultsSummary: data.settings?.showResultsSummary ?? defaults.showResultsSummary,
      disableAutosave: data.settings?.disableAutosave ?? defaults.disableAutosave,

      startDate: data.settings?.startDate || null,
      endDate: data.settings?.endDate || null,
      timeLimit: data.settings?.timeLimit ? Number(data.settings.timeLimit) : null,
    },
    questions: data.questions || [],
  };
};

export const sanitizeSurveyForAnswer = sanitizeSurveyData;