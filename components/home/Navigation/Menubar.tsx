import { useAppContext } from "@/components/AppContext";
import Button from "@/components/common/Button";
import { ActionType } from "@/reducers/AppReducer";
import { HiPlus } from "react-icons/hi2";
import { LuPanelLeft } from "react-icons/lu";
//顶部菜单栏
export default function Menubar() {
  const { dispatch } = useAppContext();
  return (
    <div className="flex space-x-3">
      <Button
        icon={HiPlus}
        variant="outline"
        className="flex-1"
        onClick={() => {
          dispatch({
            type: ActionType.UPDATE,
            field: "selectedChat",
            value: null,
          });
        }}
      >
        新建对话
      </Button>
      {/* 控制左侧导航栏的展开和收起 */}
      <Button
        icon={LuPanelLeft}
        variant="outline"
        onClick={() => {
          //隐藏左侧导航栏
          dispatch({
            type: ActionType.UPDATE,
            field: "displayNavigation",
            value: false,
          });
        }}
      />
    </div>
  );
}
