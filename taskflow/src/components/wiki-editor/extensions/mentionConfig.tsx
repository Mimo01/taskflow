/**
 * mentionConfig — @tiptap/extension-mention configured for Jira user mentions.
 *
 * Wires suggestion.items to fetchAssignableUsers (same data source as MentionPopover).
 * Renders the suggestion dropdown using ReactRenderer into a floating div positioned
 * relative to the cursor.
 *
 * Usage: createMentionExtension({ projectKey, jiraBaseUrl }) → AnyExtension
 * Pass to buildExtensions({ mention: createMentionExtension(...) }) in WikiEditor.
 *
 * Serialization: mention node attrs.id = user.name (DC username) for [~username] form.
 * For [~accountId:XXX], we never create those interactively — they come from loaded content.
 */

import type { AnyExtension } from '@tiptap/core';
import { Mention } from '@tiptap/extension-mention';
import { ReactRenderer } from '@tiptap/react';
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { CachedAvatar } from '@/components/ui/cached-avatar';
import type { JiraAssignableUser } from '@/services/jira/types';
import { fetchAssignableUsers } from '@/services/jira/users';
import { readSecret } from '@/services/stronghold';

// ---------------------------------------------------------------------------
// Suggestion list component
// ---------------------------------------------------------------------------

interface MentionListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

interface MentionListProps extends SuggestionProps {
  items: JiraAssignableUser[];
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>(function MentionList(
  { items, command },
  ref,
) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: items reference reset is intentional — matching MentionPopover pattern
  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  useImperativeHandle(ref, () => ({
    onKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowUp') {
        setSelectedIndex((i) => (i > 0 ? i - 1 : Math.max(items.length - 1, 0)));
        return true;
      }
      if (e.key === 'ArrowDown') {
        setSelectedIndex((i) => (i < items.length - 1 ? i + 1 : 0));
        return true;
      }
      if (e.key === 'Enter') {
        const item = items[selectedIndex];
        if (item) {
          command({ id: item.name, label: item.displayName });
        }
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-popover border rounded-md shadow-lg p-2 text-sm text-muted-foreground min-w-[200px]">
        No matching users
      </div>
    );
  }

  return (
    <div
      role="listbox"
      className="bg-popover border rounded-md shadow-lg p-1 min-w-[200px] max-h-[240px] overflow-y-auto"
    >
      {items.map((user, index) => {
        const avatarUrl =
          user.avatarUrls?.['48x48'] ?? user.avatarUrls?.['24x24'] ?? user.avatarUrls?.['16x16'];
        const isActive = index === selectedIndex;
        return (
          <div
            key={user.name}
            role="option"
            tabIndex={-1}
            aria-selected={isActive}
            className={`flex items-center gap-2 px-2 py-1.5 rounded-sm cursor-pointer text-sm ${
              isActive ? 'bg-accent text-accent-foreground' : 'hover:bg-accent/50'
            }`}
            onClick={() => command({ id: user.name, label: user.displayName })}
            onKeyDown={(e) => {
              if (e.key === 'Enter') command({ id: user.name, label: user.displayName });
            }}
            onMouseEnter={() => setSelectedIndex(index)}
          >
            <CachedAvatar url={avatarUrl} name={user.displayName} size={20} className="shrink-0" />
            <span className="truncate">{user.displayName}</span>
            <span className="text-muted-foreground text-xs ml-auto truncate">{user.name}</span>
          </div>
        );
      })}
    </div>
  );
});

// ---------------------------------------------------------------------------
// Factory function
// ---------------------------------------------------------------------------

/**
 * Create a configured mention extension with Jira user suggestion.
 * Also handles <mention data-id> parseHTML for the load path.
 */
export function createMentionExtension({
  projectKey,
  jiraBaseUrl,
}: {
  projectKey: string;
  jiraBaseUrl: string;
}): AnyExtension {
  return Mention.extend({
    parseHTML() {
      return [
        { tag: `span[data-type="${this.name}"]` },
        {
          // Jira preprocessor output: <mention data-id="...">
          // jiraToTiptap pre-marks accountId mentions with "accountId:" prefix in data-id
          tag: 'mention[data-id]',
          getAttrs: (el) => {
            const element = el as HTMLElement;
            return {
              id: element.getAttribute('data-id') ?? '',
              label: element.textContent ?? '',
            };
          },
        },
      ];
    },
  }).configure({
    HTMLAttributes: {
      class:
        'mention-badge inline-flex items-center rounded bg-primary/15 text-primary px-1.5 py-0.5 text-xs font-medium',
    },
    suggestion: {
      char: '@',
      allowSpaces: false,

      items: async ({ query }: { query: string }): Promise<JiraAssignableUser[]> => {
        try {
          const token = await readSecret('jira-pat').catch(() => null);
          if (!token || !jiraBaseUrl || !projectKey) return [];
          return fetchAssignableUsers(jiraBaseUrl, token, projectKey, query);
        } catch {
          return [];
        }
      },

      render: () => {
        let component: ReactRenderer<MentionListHandle, MentionListProps>;
        let popupEl: HTMLDivElement | null = null;

        function positionPopup(clientRect: (() => DOMRect | null) | null | undefined) {
          if (!popupEl || !clientRect) return;
          const rect = clientRect();
          if (!rect) return;
          const scrollY = window.scrollY;
          const scrollX = window.scrollX;
          popupEl.style.top = `${rect.bottom + scrollY + 4}px`;
          popupEl.style.left = `${rect.left + scrollX}px`;
        }

        return {
          onStart(props: SuggestionProps) {
            // Create a floating container anchored to document.body
            popupEl = document.createElement('div');
            popupEl.style.position = 'absolute';
            popupEl.style.zIndex = '9999';
            document.body.appendChild(popupEl);

            component = new ReactRenderer(MentionList, {
              props: props as MentionListProps,
              editor: props.editor,
            });
            popupEl.appendChild(component.element);
            positionPopup(props.clientRect);
          },

          onUpdate(props: SuggestionProps) {
            component.updateProps(props as MentionListProps);
            positionPopup(props.clientRect);
          },

          onKeyDown(props: SuggestionKeyDownProps) {
            if (props.event.key === 'Escape') {
              if (popupEl) popupEl.style.display = 'none';
              return true;
            }
            return component.ref?.onKeyDown(props.event) ?? false;
          },

          onExit() {
            if (popupEl) {
              document.body.removeChild(popupEl);
              popupEl = null;
            }
            component.destroy();
          },
        };
      },
    },
  });
}
