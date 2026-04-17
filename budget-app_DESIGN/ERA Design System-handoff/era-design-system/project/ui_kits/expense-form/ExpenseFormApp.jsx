// ExpenseFormApp.jsx — full interactive flow demo for the New Expense Form

const { useState: useS } = React;

function ExpenseFormApp({ theme = 'blue' }) {
  const [step, setStep] = useS(0);
  const [amount, setAmount] = useS('');
  const [desc, setDesc] = useS('');
  const [category, setCategory] = useS('');
  const [saving, setSaving] = useS(false);
  const [success, setSuccess] = useS(false);
  const [micActive, setMicActive] = useS(false);

  const goNext = () => setStep(s => Math.min(s + 1, 3));
  const goBack = () => setStep(s => Math.max(s - 1, 0));

  const handleSelectCategory = (name) => {
    setCategory(name);
    setTimeout(() => setStep(3), 280); // auto-advance with small pause
  };

  const handleConfirm = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setStep(0);
        setAmount('');
        setDesc('');
        setCategory('');
      }, 1800);
    }, 700);
  };

  return (
    <div data-theme={theme} style={{ height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--era-bg)', color: 'var(--era-fg)', fontFamily: 'var(--era-font-body)' }}>
      <AppHeader drafts={2} />

      <SuccessToast show={success} amount={parseFloat(amount||0).toFixed(2)} category={category} />

      <div style={{ flex: 1, overflow: 'auto', padding: '14px 16px 120px' }}>
        <BalanceRow />
        <StepIndicator current={step} />

        {step === 0 && (
          <AmountStep
            value={amount}
            onChange={setAmount}
            onNext={goNext}
            onCalc={() => {}}
            onMic={() => setMicActive(m => !m)}
            micActive={micActive}
          />
        )}
        {step === 1 && (
          <CategoryStep selected={category} onSelect={handleSelectCategory} onBack={goBack} />
        )}
        {step === 2 && (
          <CategoryStep selected={category} onSelect={handleSelectCategory} onBack={goBack} />
        )}
        {step === 3 && (
          <ConfirmStep
            amount={amount} category={category} desc={desc}
            onBack={goBack} onConfirm={handleConfirm} saving={saving}
          />
        )}

        {/* ambient background glow */}
        <div style={{
          position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1,
          background: 'radial-gradient(ellipse at top, rgba(6,182,212,0.08), transparent 60%), radial-gradient(ellipse at bottom, rgba(59,130,246,0.06), transparent 55%)',
        }}/>
      </div>

      <BottomNav active="expense" />
    </div>
  );
}

window.ExpenseFormApp = ExpenseFormApp;
