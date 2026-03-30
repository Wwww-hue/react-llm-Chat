import { useAppContext } from "@/components/AppContext";
import Button from "@/components/common/Button";
import { ActionType } from "@/reducers/AppReducer";
import { MdLightMode, MdDarkMode, MdInfo } from "react-icons/md";
//顶部菜单栏
export default function Toolbar() {
  const {
    state: { themeNode },
    dispatch,
  } = useAppContext();
  return (
    <div className="absolute bottom-0 left-0 right-0 bg-gray-800 flex p-2 justify-between">
      {/* 控制主题模式 */}
      <Button
        icon={themeNode === "dark" ? MdLightMode : MdDarkMode}
        variant="text"
        onClick={() => {
          //切换主题模式
          dispatch({
            type: ActionType.UPDATE,
            field: "themeNode",
            value: themeNode === "dark" ? "light" : "dark",
          });
        }}
      />
      <Button icon={MdInfo} variant="text" />
    </div>
  );
}
