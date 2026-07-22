import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ChatMessages } from '../src/components/ChatMessages';

const CHAT_LOG_LABEL = '\u804a\u5929\u8bb0\u5f55';
const WELCOME_MESSAGE =
  '\u4f60\u597d\uff0c\u6211\u662f\u4e91\u5c9a\u53e4\u9547\u6570\u5b57\u5bfc\u6e38\u3002\u53ef\u4ee5\u95ee\u6211\u8def\u7ebf\u3001\u62cd\u7167\u70b9\u3001\u5f00\u653e\u65f6\u95f4\u6216\u4eb2\u5b50\u6e38\u5b89\u6392\u3002';

describe('ChatMessages', () => {
  it('renders the empty-state welcome copy in Chinese', () => {
    render(<ChatMessages messages={[]} />);

    expect(screen.getByLabelText(CHAT_LOG_LABEL)).toBeInTheDocument();
    expect(screen.getByText(WELCOME_MESSAGE)).toBeInTheDocument();
  });
});
