import { MdOutlineTipsAndUpdates } from "react-icons/md";
import examples from "@/data/examples.json";
import Button from "@/components/common/Button";
import { useMemo, useState } from "react";
import { useAppContext } from "@/components/AppContext";
import { ActionType } from "@/reducers/AppReducer";

export default function Example() {
  const {
    state: { streamingId },
    dispatch,
  } = useAppContext();
  const [showFull, setShowFull] = useState(false);
  const list = useMemo(() => {
    if (showFull) {
      return examples;
    }
    return examples.slice(0, 15);
  }, [showFull]);
  return (
    <>
      <div className="mt-20 mb-4 text-4xl">
        <MdOutlineTipsAndUpdates />
      </div>
      <ul className="flex justify-center flex-wrap gap-3.5">
        {list.map((item) => {
          return (
            <li key={item.act}>
              <Button
                disabled={streamingId !== ""}
                onClick={() => {
                  if (streamingId !== "") return;
                  dispatch({
                    type: ActionType.UPDATE,
                    field: "selectedChat",
                    value: undefined,
                  });
                  dispatch({ type: ActionType.UPDATE, field: "messageList", value: [] });
                  dispatch({
                    type: ActionType.UPDATE,
                    field: "pendingPrompt",
                    value: item.prompt,
                  });
                }}
              >
                {item.act}
              </Button>
            </li>
          );
        })}
      </ul>
      {!showFull && (
        <>
          <p className="p-2">...</p>
          <div className="flex itmes-center w-full space-x-2">
            <hr className="flex-1 border-t border-dotted border-gray-200 dark:border-gray-600" />
            <Button onClick={() => setShowFull(true)}>显示全部</Button>
            <hr className="flex-1 border-t border-dotted border-gray-200 dark:border-gray-600" />
          </div>
        </>
      )}
    </>
  );
}
