import { motion } from 'framer-motion';

interface NumericKeypadProps {
  onKey: (key: string) => void;
  onDelete: () => void;
  onEnter: () => void;
}

const NumericKeypad = ({ onKey, onDelete, onEnter }: NumericKeypadProps) => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ent'];

const provideFeedback = () => {
  if (navigator.vibrate) {
    navigator.vibrate(30);
  } else {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      const osc = audioContext.createOscillator();
      const gain = audioContext.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(900, audioContext.currentTime);

      gain.gain.setValueAtTime(0.08, audioContext.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.025);

      osc.connect(gain);
      gain.connect(audioContext.destination);

      osc.start(audioContext.currentTime);
      osc.stop(audioContext.currentTime + 0.025);

    } catch (error) {
      console.log('Audio feedback not available');
    }
  }
};

  return (
    <div className="grid grid-cols-3 gap-2 p-3 max-w-xs mx-auto">
      {keys.map((key) => (
        <motion.button
          key={key}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.02 }}
          className={
            key === 'ent'
              ? 'keypad-btn-gold font-bold'
              : key === 'del'
              ? 'keypad-btn text-destructive font-bold'
              : 'keypad-btn'
          }
          onClick={() => {
            provideFeedback();
            if (key === 'del') onDelete();
            else if (key === 'ent') onEnter();
            else onKey(key);
          }}
        >
          {key === 'del' ? '⌫' : key === 'ent' ? '↵' : key}
        </motion.button>
      ))}
    </div>
  );
};

export default NumericKeypad;
