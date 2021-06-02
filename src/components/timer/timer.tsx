import { useState, useEffect } from 'react';
import classNames from 'classnames';
import { getDays, getHours, getMinutes, getSeconds } from '../../utils/generic';
import globalStyles from '../../styles/global-styles.module.scss';
import styles from './timer.module.scss';

interface Props {
  deadline: Date;
  size?: 'normal' | 'large';
}

const Timer = (props: Props) => {
  const { deadline, size = 'normal' } = props;
  const [timerDays, setTimerDays] = useState('00');
  const [timerHours, setTimerHours] = useState('00');
  const [timerMinutes, setTimerMinutes] = useState('00');
  const [timerSeconds, setTimerSeconds] = useState('00');
  const [dateDiff, setDateDiff] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date().getTime();
      const deadlineDate = deadline.getTime();

      let distance = deadlineDate - now;

      if (distance < 0) {
        clearInterval(timer);
        distance = 0;
      }

      const days = getDays(distance);
      const hours = getHours(distance);
      const minutes = getMinutes(distance);
      const seconds = getSeconds(distance);

      setTimerDays(days);
      setTimerHours(hours);
      setTimerMinutes(minutes);
      setTimerSeconds(seconds);
      setDateDiff(distance);
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, [deadline]);

  const largeSize = size === 'large' ? `${styles.large}` : '';

  return (
    <div className={classNames(styles.timer, largeSize)}>
      <div className={styles.timerContainer}>
        <div className={styles.timerWrap}>
          <div className={styles.timerNumber}>{timerDays}</div>
          <div className={globalStyles.tertiaryColor}>D</div>
        </div>
        <div className={styles.timerColon}>:</div>
        <div className={styles.timerWrap}>
          <div className={styles.timerNumber}>{timerHours}</div>
          <div className={globalStyles.tertiaryColor}>HR</div>
        </div>
        <div className={styles.timerColon}>:</div>
        <div className={styles.timerWrap}>
          <div className={styles.timerNumber}>{timerMinutes}</div>
          <div className={globalStyles.tertiaryColor}>MIN</div>
        </div>
        {size === 'large' && (
          <>
            <div className={styles.timerColon}>:</div>
            <div className={styles.timerWrap}>
              <div className={styles.timerNumber}>{timerSeconds}</div>
              <div className={globalStyles.tertiaryColor}>SEC</div>
            </div>
          </>
        )}
      </div>
      {dateDiff > 0 && <div>remaining</div>}
    </div>
  );
};

export default Timer;
