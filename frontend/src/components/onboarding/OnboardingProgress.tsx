import React from 'react';
import { User, Music, FileCheck, CheckCircle, Circle, Clock, XCircle } from 'lucide-react';

interface OnboardingProgressProps {
  currentStep: number;
  onboardingStatus: string;
  compact?: boolean;
}

const steps = [
  { num: 1, label: 'Personal Info', icon: User },
  { num: 2, label: 'Music Info', icon: Music },
  { num: 3, label: 'Documents', icon: FileCheck },
  { num: 4, label: 'Approval', icon: CheckCircle },
];

const OnboardingProgress: React.FC<OnboardingProgressProps> = ({
  currentStep,
  onboardingStatus,
  compact = false,
}) => {
  const isComplete = onboardingStatus === 'approved';
  const isRejected = onboardingStatus === 'rejected';
  const isPending = onboardingStatus === 'pending_approval';

  if (compact) {
    const progress = isComplete ? 100 : isRejected ? 100 : ((currentStep - 1) / 3) * 100;
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-gray-500">Onboarding</span>
          <span className={`text-xs font-medium ${isComplete ? 'text-emerald-600' : isRejected ? 'text-red-500' : 'text-indigo-600'}`}>
            {isComplete ? 'Complete' : isRejected ? 'Rejected' : isPending ? 'Pending' : `${Math.round(progress)}%`}
          </span>
        </div>
        <div className="h-1 rounded-full bg-gray-200 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${progress}%`,
              background: isComplete
                ? '#10B981'
                : isRejected
                ? '#EF4444'
                : '#4F46E5',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-between relative">
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-gray-200" />
        <div
          className="absolute top-5 left-0 h-0.5 transition-all duration-500"
          style={{
            width: isComplete || isRejected ? '100%' : `${((currentStep - 1) / 3) * 100}%`,
            background: isComplete ? '#10B981' : isRejected ? '#EF4444' : '#4F46E5',
          }}
        />

        {steps.map(({ num, label, icon: Icon }) => {
          const isActive = currentStep === num && !isComplete && !isRejected;
          const isDone = isComplete || currentStep > num;
          const isRejectedStep = isRejected && currentStep >= num;
          const isPendingStep = isPending && currentStep === num;
          const isPendingWait = isPending && num <= currentStep;

          return (
            <div key={num} className="flex flex-col items-center relative z-10">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300"
                style={{
                  background: isDone && !isRejected
                    ? '#10B981'
                    : isRejectedStep
                    ? '#EF4444'
                    : isActive || isPendingStep || isPendingWait
                    ? '#4F46E5'
                    : '#F3F4F6',
                  border: isDone || isActive || isPendingStep || isPendingWait || isRejectedStep
                    ? 'none'
                    : '2px solid #E5E7EB',
                  boxShadow: isActive || isPendingStep ? '0 0 0 4px rgba(79,70,229,0.1)' : 'none',
                }}
              >
                {isDone && !isRejected ? (
                  <CheckCircle size={18} className="text-white" />
                ) : isRejectedStep ? (
                  <XCircle size={18} className="text-white" />
                ) : isActive || isPendingStep || isPendingWait ? (
                  isPendingWait && !isActive ? (
                    <CheckCircle size={18} className="text-white" />
                  ) : (
                    <Icon size={16} className="text-white" />
                  )
                ) : (
                  <Circle size={16} className="text-gray-400" />
                )}
              </div>
              <span
                className="text-xs mt-2.5 font-medium whitespace-nowrap"
                style={{
                  color: (isDone && !isRejected) || isPendingWait ? '#059669' : isRejectedStep ? '#DC2626' : isActive || isPendingStep ? '#4F46E5' : '#9CA3AF',
                }}
              >
                {label}
              </span>
              {isPendingStep && (
                <span className="text-[10px] text-amber-600 mt-1 flex items-center gap-1">
                  <Clock size={8} /> Waiting
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OnboardingProgress;
